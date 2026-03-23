import { tool } from "ai";
import { z } from "zod";
import { google } from "googleapis";

function getClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return auth;
}

export function createGoogleTools(accessToken: string) {
  const auth = getClient(accessToken);

  // ---------------------------------------------------------------------------
  // Gmail
  // ---------------------------------------------------------------------------

  const gmailListEmails = tool({
    description: "List recent emails from Gmail. Returns subject, sender, date, and snippet.",
    inputSchema: z.object({
      maxResults: z.number().optional().default(10).describe("Number of emails to return (default 10)"),
      query: z.string().optional().describe("Gmail search query, e.g. 'is:unread', 'from:someone@gmail.com'"),
    }),
    execute: async ({ maxResults, query }) => {
      const gmail = google.gmail({ version: "v1", auth });
      const list = await gmail.users.messages.list({
        userId: "me",
        maxResults,
        q: query,
      });
      const messages = list.data.messages ?? [];
      const details = await Promise.all(
        messages.map((m) =>
          gmail.users.messages.get({
            userId: "me",
            id: m.id!,
            format: "metadata",
            metadataHeaders: ["Subject", "From", "Date"],
          })
        )
      );
      return details.map((d) => {
        const headers = d.data.payload?.headers ?? [];
        const get = (name: string) => headers.find((h) => h.name === name)?.value ?? "";
        return {
          id: d.data.id,
          subject: get("Subject"),
          from: get("From"),
          date: get("Date"),
          snippet: d.data.snippet,
        };
      });
    },
  });

  const gmailGetEmail = tool({
    description: "Get the full content of a specific email by ID.",
    inputSchema: z.object({
      id: z.string().describe("The email message ID"),
    }),
    execute: async ({ id }) => {
      const gmail = google.gmail({ version: "v1", auth });
      const msg = await gmail.users.messages.get({ userId: "me", id, format: "full" });
      const headers = msg.data.payload?.headers ?? [];
      const get = (name: string) => headers.find((h) => h.name === name)?.value ?? "";

      // Extract text body
      let body = "";
      const parts = msg.data.payload?.parts ?? [];
      const textPart = parts.find((p) => p.mimeType === "text/plain") ?? msg.data.payload;
      if (textPart?.body?.data) {
        body = Buffer.from(textPart.body.data, "base64").toString("utf-8");
      }

      return {
        id: msg.data.id,
        subject: get("Subject"),
        from: get("From"),
        to: get("To"),
        date: get("Date"),
        body: body.slice(0, 5000), // cap at 5k chars
      };
    },
  });

  const gmailSendEmail = tool({
    description: "Send an email via Gmail.",
    inputSchema: z.object({
      to: z.string().describe("Recipient email address"),
      subject: z.string().describe("Email subject"),
      body: z.string().describe("Plain text email body"),
    }),
    execute: async ({ to, subject, body }) => {
      const gmail = google.gmail({ version: "v1", auth });
      const raw = Buffer.from(
        `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`
      )
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
      await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
      return { success: true };
    },
  });

  // ---------------------------------------------------------------------------
  // Google Calendar
  // ---------------------------------------------------------------------------

  const calendarListEvents = tool({
    description: "List upcoming Google Calendar events.",
    inputSchema: z.object({
      maxResults: z.number().optional().default(10).describe("Number of events to return"),
      timeMin: z.string().optional().describe("Start time filter (ISO 8601). Defaults to now."),
      timeMax: z.string().optional().describe("End time filter (ISO 8601)"),
      calendarId: z.string().optional().default("primary").describe("Calendar ID (default: primary)"),
    }),
    execute: async ({ maxResults, timeMin, timeMax, calendarId }) => {
      const calendar = google.calendar({ version: "v3", auth });
      const res = await calendar.events.list({
        calendarId,
        maxResults,
        timeMin: timeMin ?? new Date().toISOString(),
        timeMax,
        singleEvents: true,
        orderBy: "startTime",
      });
      return (res.data.items ?? []).map((e) => ({
        id: e.id,
        summary: e.summary,
        start: e.start?.dateTime ?? e.start?.date,
        end: e.end?.dateTime ?? e.end?.date,
        location: e.location,
        description: e.description,
      }));
    },
  });

  const calendarCreateEvent = tool({
    description: "Create a new Google Calendar event.",
    inputSchema: z.object({
      summary: z.string().describe("Event title"),
      start: z.string().describe("Start time (ISO 8601)"),
      end: z.string().describe("End time (ISO 8601)"),
      description: z.string().optional().describe("Event description"),
      location: z.string().optional().describe("Event location"),
      calendarId: z.string().optional().default("primary"),
    }),
    execute: async ({ summary, start, end, description, location, calendarId }) => {
      const calendar = google.calendar({ version: "v3", auth });
      const res = await calendar.events.insert({
        calendarId,
        requestBody: {
          summary,
          description,
          location,
          start: { dateTime: start },
          end: { dateTime: end },
        },
      });
      return { id: res.data.id, htmlLink: res.data.htmlLink };
    },
  });

  // ---------------------------------------------------------------------------
  // Google Drive
  // ---------------------------------------------------------------------------

  const driveListFiles = tool({
    description: "List files in Google Drive.",
    inputSchema: z.object({
      maxResults: z.number().optional().default(10).describe("Number of files to return"),
      query: z.string().optional().describe("Drive search query, e.g. \"name contains 'report'\""),
    }),
    execute: async ({ maxResults, query }) => {
      const drive = google.drive({ version: "v3", auth });
      const res = await drive.files.list({
        pageSize: maxResults,
        q: query,
        fields: "files(id, name, mimeType, modifiedTime, size)",
      });
      return res.data.files ?? [];
    },
  });

  const driveGetFile = tool({
    description: "Get the text content of a Google Drive file (Docs, plain text, etc.).",
    inputSchema: z.object({
      fileId: z.string().describe("The Drive file ID"),
    }),
    execute: async ({ fileId }) => {
      const drive = google.drive({ version: "v3", auth });
      // Try exporting as plain text first (works for Docs/Sheets/Slides)
      try {
        const res = await drive.files.export(
          { fileId, mimeType: "text/plain" },
          { responseType: "text" }
        );
        return { content: (res.data as string).slice(0, 10000) };
      } catch {
        // Fall back to direct download for binary/text files
        const res = await drive.files.get(
          { fileId, alt: "media" },
          { responseType: "text" }
        );
        return { content: (res.data as string).slice(0, 10000) };
      }
    },
  });

  // ---------------------------------------------------------------------------
  // Google Docs
  // ---------------------------------------------------------------------------

  const docsGetDocument = tool({
    description: "Get the content of a Google Doc by ID.",
    inputSchema: z.object({
      documentId: z.string().describe("The Google Doc ID (from the URL)"),
    }),
    execute: async ({ documentId }) => {
      const docs = google.docs({ version: "v1", auth });
      const res = await docs.documents.get({ documentId });
      // Extract plain text from the document body
      const content = res.data.body?.content ?? [];
      const text = content
        .flatMap((el) => el.paragraph?.elements ?? [])
        .map((el) => el.textRun?.content ?? "")
        .join("");
      return { title: res.data.title, text: text.slice(0, 10000) };
    },
  });

  // ---------------------------------------------------------------------------
  // Google Slides
  // ---------------------------------------------------------------------------

  const slidesGetPresentation = tool({
    description: "Get the content of a Google Slides presentation by ID.",
    inputSchema: z.object({
      presentationId: z.string().describe("The Google Slides presentation ID (from the URL)"),
    }),
    execute: async ({ presentationId }) => {
      const slides = google.slides({ version: "v1", auth });
      const res = await slides.presentations.get({ presentationId });
      const slidesSummary = (res.data.slides ?? []).map((slide, i) => {
        const texts = (slide.pageElements ?? [])
          .flatMap((el) => el.shape?.text?.textElements ?? [])
          .map((te) => te.textRun?.content ?? "")
          .join(" ")
          .trim();
        return { slide: i + 1, text: texts };
      });
      return { title: res.data.title, slides: slidesSummary };
    },
  });

  return {
    gmail_list_emails: gmailListEmails,
    gmail_get_email: gmailGetEmail,
    gmail_send_email: gmailSendEmail,
    calendar_list_events: calendarListEvents,
    calendar_create_event: calendarCreateEvent,
    drive_list_files: driveListFiles,
    drive_get_file: driveGetFile,
    docs_get_document: docsGetDocument,
    slides_get_presentation: slidesGetPresentation,
  };
}
