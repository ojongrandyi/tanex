import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Inbox, Mail, Phone, MapPin, Package, RefreshCw, CheckCircle2, Eye, RotateCcw, AlertTriangle, Reply } from 'lucide-react';
import { api } from '../../services/api';
import { usePermission } from '../../auth/AuthContext';
import type { ContactMessage, ContactMessageStatus } from '../../types/admin';
import './MessagesView.css';
import { MESSAGES_VIEW_TEXT as TXT } from './MessagesView.text';
import { consoleIntlLocale } from '../i18n/consoleText';

interface MessagesViewProps {
  searchQuery: string;
  /** Called after any change so the sidebar's unread count stays in step. */
  onMessagesChanged?: (messages: ContactMessage[]) => void;
}

type Filter = 'ALL' | ContactMessageStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'ALL', get label() { return TXT.all; } },
  { value: 'NEW', get label() { return TXT.new; } },
  { value: 'READ', get label() { return TXT.read; } },
  { value: 'RESOLVED', get label() { return TXT.resolved; } },
];

const formatReceived = (iso: string) =>
  new Date(iso).toLocaleString(consoleIntlLocale(), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const MessagesView: React.FC<MessagesViewProps> = ({ searchQuery, onMessagesChanged }) => {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // messages.view reads; marking read/resolved/unread needs messages.manage.
  const canManage = usePermission('messages.manage');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getContactMessages();
      setMessages(data);
      onMessagesChanged?.(data);
    } catch (err: any) {
      setError(err?.message || TXT.couldNotLoadMessages);
    } finally {
      setLoading(false);
    }
  }, [onMessagesChanged]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (id: string, status: ContactMessageStatus) => {
    setBusyId(id);
    try {
      const updated = await api.updateContactMessageStatus(id, status);
      const next = messages.map((m) => (m.id === id ? updated : m));
      setMessages(next);
      onMessagesChanged?.(next);
    } catch (err: any) {
      setError(TXT.couldNotUpdate(id, err?.message || TXT.serverError));
    } finally {
      setBusyId(null);
    }
  };

  // Opening a new message marks it read.
  const toggleOpen = (msg: ContactMessage) => {
    const opening = openId !== msg.id;
    setOpenId(opening ? msg.id : null);
    if (opening && msg.status === 'NEW' && canManage) setStatus(msg.id, 'READ');
  };

  const visible = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return messages.filter((m) => {
      if (filter !== 'ALL' && m.status !== filter) return false;
      if (!q) return true;
      return [m.id, m.name, m.email, m.phone, m.subject, m.trackingNumber, m.gatewayCode, m.message]
        .some((field) => field?.toLowerCase().includes(q));
    });
  }, [messages, filter, searchQuery]);

  const counts = useMemo(() => ({
    ALL: messages.length,
    NEW: messages.filter((m) => m.status === 'NEW').length,
    READ: messages.filter((m) => m.status === 'READ').length,
    RESOLVED: messages.filter((m) => m.status === 'RESOLVED').length,
  }), [messages]);

  return (
    <div className="tx-messages-workspace animate-fade-in">
      <div className="messages-toolbar">
        <div className="messages-filters" role="tablist" aria-label={TXT.filterMessages}>
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={filter === f.value}
              className={`messages-filter-btn ${filter === f.value ? 'active' : ''}`}
              onClick={() => setFilter(f.value)}
            >
              {f.label} <span className="font-mono">{counts[f.value]}</span>
            </button>
          ))}
        </div>
        <button type="button" className="messages-refresh-btn" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>{TXT.refresh}</span>
        </button>
      </div>

      {error && (
        <div className="messages-error">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {!loading && visible.length === 0 && (
        <div className="messages-empty">
          <Inbox size={28} />
          <strong>{messages.length === 0 ? TXT.noMessagesYet : TXT.noMessagesMatch}</strong>
          <p>{messages.length === 0 ? TXT.messagesFromTheContactPage : TXT.tryAnotherFilterOrClear}</p>
        </div>
      )}

      <div className="messages-list">
        {visible.map((m) => {
          const isOpen = openId === m.id;
          return (
            <article key={m.id} className={`message-card status-${m.status.toLowerCase()} ${isOpen ? 'open' : ''}`}>
              <button type="button" className="message-summary" onClick={() => toggleOpen(m)} aria-expanded={isOpen}>
                <span className={`message-status-dot ${m.status.toLowerCase()}`} aria-hidden="true" />
                <div className="message-summary-main">
                  <div className="message-summary-top">
                    <strong>{m.name}</strong>
                    <span className="message-subject">{m.subject}</span>
                    {m.priority !== 'routine' && (
                      <span className={`message-priority ${m.priority} font-mono`}>{m.priority.toUpperCase()}</span>
                    )}
                    {m.gatewayCode && <span className="message-gateway font-mono">{m.gatewayCode}</span>}
                  </div>
                  <p className="message-preview">{m.message}</p>
                </div>
                <div className="message-summary-meta">
                  <span className="font-mono">{m.id}</span>
                  <small>{formatReceived(m.createdAt)}</small>
                </div>
              </button>

              {isOpen && (
                <div className="message-detail">
                  <div className="message-detail-grid">
                    {m.email && <div><Mail size={14} /><a href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject} [${m.id}]`)}`}>{m.email}</a></div>}
                    {m.phone && <div><Phone size={14} /><a href={`tel:${m.phone.replace(/[^\d+]/g, '')}`}>{m.phone}</a></div>}
                    {m.trackingNumber && <div><Package size={14} /><span className="font-mono">{m.trackingNumber}</span></div>}
                    {m.gatewayLabel && <div><MapPin size={14} /><span>{m.gatewayLabel}</span></div>}
                  </div>
                  <p className="message-body">{m.message}</p>
                  <div className="message-actions">
                    {/* Home callback requests carry a phone number and no email. */}
                    {m.email ? (
                      <a className="message-action primary" href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject} [${m.id}]`)}`}>
                        <Reply size={14} /><span>{TXT.replyByEmail}</span>
                      </a>
                    ) : m.phone && (
                      <a className="message-action primary" href={`tel:${m.phone.replace(/[^\d+]/g, '')}`}>
                        <Phone size={14} /><span>{TXT.callBack}</span>
                      </a>
                    )}
                    {canManage && (m.status !== 'RESOLVED' ? (
                      <button type="button" className="message-action" disabled={busyId === m.id} onClick={() => setStatus(m.id, 'RESOLVED')}>
                        <CheckCircle2 size={14} /><span>{TXT.markResolved}</span>
                      </button>
                    ) : (
                      <button type="button" className="message-action" disabled={busyId === m.id} onClick={() => setStatus(m.id, 'READ')}>
                        <RotateCcw size={14} /><span>{TXT.reopen}</span>
                      </button>
                    ))}
                    {canManage && m.status !== 'NEW' && (
                      <button type="button" className="message-action" disabled={busyId === m.id} onClick={() => setStatus(m.id, 'NEW')}>
                        <Eye size={14} /><span>{TXT.markUnread}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
};
