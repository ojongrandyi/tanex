// MessagesView copy (console, tracker I.2). English master; the French is in
// src/i18n/fr/console/messagesView.ts (same keys, checked by the build).
import { consoleText } from '../i18n/consoleText';

export const MESSAGES_VIEW_TEXT_EN = {
  serverError: 'server error',
  couldNotLoadMessages: 'Could not load messages.',
  couldNotUpdate: (p0: unknown, p1: unknown) => `Could not update ${p0}: ${p1}`,
  filterMessages: 'Filter messages',
  refresh: 'Refresh',
  replyByEmail: 'Reply by email',
  callBack: 'Call back',
  markResolved: 'Mark resolved',
  reopen: 'Reopen',
  markUnread: 'Mark unread',
  all: 'All',
  new: 'New',
  read: 'Read',
  resolved: 'Resolved',
  noMessagesYet: 'No messages yet',
  noMessagesMatch: 'No messages match',
  messagesFromTheContactPage: 'Messages from the Contact page and Home callback requests will appear here.',
  tryAnotherFilterOrClear: 'Try another filter or clear the search.',
};

export const MESSAGES_VIEW_TEXT = consoleText('messagesView', MESSAGES_VIEW_TEXT_EN);
