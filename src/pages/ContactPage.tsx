import React, { useState } from 'react';
import { ArrowRight, Check, Clock, ExternalLink, Headphones, Mail, MapPin, MessageCircle, Phone, Plus } from 'lucide-react';
import { Button, Input, Select, Textarea } from '../components/ui';
import { Link } from '../router/Link';
import { useApiErrorText, useAreaT, useLocale } from '../i18n/I18nProvider';
import { formatOpeningHoursIn } from '../i18n/format';
import { useCompanyContact } from '../utils/useCompanyContact';
import { OFFICES, PHONE, PHONE_2, TRACKING_ID_EXAMPLE, formatPhone } from '../config/brand';
import { api } from '../services/api';
import { GATEWAYS, gatewayName, getGateway } from '../data/gateways';
import { HELP_ARTICLES, CONTACT_QUICK_ANSWER_IDS } from '../data/helpArticles';
import './ContactPage.css';

// Contact page (CONTENT §8.3, §8.4, §8.6). Channels hide when their value is empty (WhatsApp until
// #100). Offices link to Google Maps searches of the written address: the exact pins are not
// confirmed yet (#120), so no pin is placed on a map.

interface ContactPageProps {
  onNavigate: (page: string, param?: string) => void;
  /** Gateway code pre-filled by "Contact us about this lane" (Network page, homepage map). */
  initialGateway?: string;
}

// Stored as the message subject in the console inbox (staff-facing, English until phase I).
const TOPICS = [
  { key: 'quote', value: 'Quote' },
  { key: 'shipment', value: 'Active shipment' },
  { key: 'billing', value: 'Billing' },
  { key: 'partnership', value: 'Partnership' },
  { key: 'other', value: 'Other' },
] as const;

const QUICK_ANSWERS = CONTACT_QUICK_ANSWER_IDS
  .map((id) => HELP_ARTICLES.find((a) => a.id === id))
  .filter((a): a is NonNullable<typeof a> => Boolean(a));

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const directionsUrl = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

export const ContactPage: React.FC<ContactPageProps> = ({ onNavigate, initialGateway = '' }) => {
  const t = useAreaT('contact');
  const th = useAreaT('help');
  const locale = useLocale();
  const apiErrorText = useApiErrorText();
  const { whatsapp, email: companyEmail, regulatoryLine } = useCompanyContact();
  const hours = formatOpeningHoursIn(locale);

  const [form, setForm] = useState({
    name: '', email: '', phone: '', topic: '', tracking: '',
    gateway: getGateway(initialGateway)?.kind === 'gateway' ? initialGateway : '',
    message: '',
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const [ticket, setTicket] = useState<{ id: string; email: string } | null>(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    const topic = TOPICS.find((x) => x.key === form.topic);
    if (!form.name.trim() || !form.email.trim() || !topic || !form.message.trim()) {
      setError(t('form.errorRequired'));
      return;
    }
    if (!EMAIL_RE.test(form.email.trim())) {
      setError(t('form.errorEmail'));
      return;
    }
    setError('');
    setSending(true);
    try {
      const saved = await api.submitContactMessage({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        subject: topic.value,
        // Active shipments are flagged for the inbox (no priority picker on the form, §8.3).
        priority: topic.key === 'shipment' ? 'urgent' : 'routine',
        trackingNumber: form.tracking.trim().toUpperCase() || undefined,
        gatewayCode: form.gateway || undefined,
        message: form.message.trim(),
      });
      setTicket({ id: saved.id, email: form.email.trim() });
    } catch (err) {
      setError(apiErrorText(err, t('form.errorSend', { email: companyEmail })));
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setForm({ name: '', email: '', phone: '', topic: '', tracking: '', gateway: '', message: '' });
    setTicket(null);
    setError('');
  };

  const offices = OFFICES.map((o) => ({
    key: o.city,
    label: o.city === 'Buea' ? t('offices.buea') : t('offices.douala'),
    address: locale === 'fr' ? o.addressFr : o.address,
    query: o.address,
  }));

  return (
    <div className="tx-contact">
      <section className="tx-contact__hero tx-dark" aria-labelledby="contact-title">
        <div className="tx-contact__wrap">
          <h1 className="tx-h1" id="contact-title">{t('hero.title')}</h1>
          <p className="tx-lead">{t('hero.sub')}</p>
          {regulatoryLine && <p className="tx-contact__reg">{regulatoryLine}</p>}
        </div>
      </section>

      <section className="tx-contact__main" aria-label={t('form.title')}>
        <div className="tx-contact__wrap tx-contact__grid">
          {/* Form */}
          <div className="tx-contact__form-col">
            {ticket ? (
              <div className="tx-contact__card tx-contact__done" role="status">
                <p className="tx-contact__done-title"><Check aria-hidden="true" />{t('success.title')}</p>
                <p>{t('success.body', { ref: ticket.id, email: ticket.email })}</p>
                <div className="tx-contact__done-actions">
                  <Button variant="secondary" onClick={reset}>{t('success.again')}</Button>
                  <Link page="track" onNavigate={onNavigate} className="tx-btn tx-btn--ghost">{t('success.track')}</Link>
                </div>
              </div>
            ) : (
              <form className="tx-contact__card tx-contact__form" onSubmit={submit} noValidate aria-labelledby="contact-form-title">
                <h2 className="tx-h3" id="contact-form-title">{t('form.title')}</h2>
                <div className="tx-contact__row">
                  <Input label={t('form.name')} value={form.name} onChange={set('name')} autoComplete="name" required maxLength={120} />
                  <Input label={t('form.email')} type="email" value={form.email} onChange={set('email')} autoComplete="email" required maxLength={160} />
                </div>
                <div className="tx-contact__row">
                  <Input label={t('form.phone')} optionalText={t('form.optional')} type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" maxLength={40} />
                  <Select label={t('form.topic')} value={form.topic} onChange={set('topic')} required>
                    <option value="" disabled>{t('form.topicPlaceholder')}</option>
                    {TOPICS.map((x) => <option key={x.key} value={x.key}>{t(`form.topics.${x.key}`)}</option>)}
                  </Select>
                </div>
                <div className="tx-contact__row">
                  <Input label={t('form.tracking')} optionalText={t('form.optional')} hint={t('form.trackingHint', { example: TRACKING_ID_EXAMPLE })}
                    value={form.tracking} onChange={set('tracking')} autoComplete="off" spellCheck={false} maxLength={14} inputClassName="tx-contact__mono" />
                  <Select label={t('form.gateway')} optionalText={t('form.optional')} value={form.gateway} onChange={set('gateway')}>
                    <option value="">{t('form.gatewayNone')}</option>
                    {GATEWAYS.map((g) => <option key={g.code} value={g.code}>{g.code} · {gatewayName(g, locale)}</option>)}
                  </Select>
                </div>
                <Textarea label={t('form.message')} value={form.message} onChange={set('message')} rows={6} required maxLength={4000} />
                {error && <p className="tx-error" role="alert">{error}</p>}
                <Button type="submit" variant="secondary" size="lg" disabled={sending}>{sending ? t('form.sending') : t('form.submit')}</Button>
              </form>
            )}
          </div>

          {/* Channels, offices, desk */}
          <aside className="tx-contact__side">
            <ul className="tx-contact__card tx-contact__channels" aria-label={t('channels.label')}>
              {[PHONE, PHONE_2].filter(Boolean).map((p) => (
                <li key={p}>
                  <span className="tx-contact__ic" aria-hidden="true"><Phone /></span>
                  <div><small>{t('channels.phone')}</small><a href={`tel:${p}`}>{formatPhone(p)}</a></div>
                </li>
              ))}
              {whatsapp && (
                <li>
                  <span className="tx-contact__ic" aria-hidden="true"><MessageCircle /></span>
                  <div><small>{t('channels.whatsapp')}</small><a href={`https://wa.me/${whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">{formatPhone(whatsapp)}</a></div>
                </li>
              )}
              {companyEmail && (
                <li>
                  <span className="tx-contact__ic" aria-hidden="true"><Mail /></span>
                  <div><small>{t('channels.email')}</small><a href={`mailto:${companyEmail}`}>{companyEmail}</a></div>
                </li>
              )}
            </ul>

            <div className="tx-contact__card">
              <h2 className="tx-contact__side-title">{t('offices.title')}</h2>
              <ul className="tx-contact__offices">
                {offices.map((o) => (
                  <li key={o.key}>
                    <span className="tx-contact__ic" aria-hidden="true"><MapPin /></span>
                    <div>
                      <strong>{o.label}</strong>
                      <p>{o.address}</p>
                      <a href={directionsUrl(o.query)} target="_blank" rel="noopener noreferrer" className="tx-link"
                        aria-label={t('offices.directionsFor', { office: o.label })}>
                        {t('offices.directions')}<ExternalLink aria-hidden="true" />
                      </a>
                    </div>
                  </li>
                ))}
                <li>
                  <span className="tx-contact__ic" aria-hidden="true"><Clock /></span>
                  <div><strong>{t('offices.hoursTitle')}</strong><p>{hours}</p></div>
                </li>
              </ul>
            </div>

            <div className="tx-contact__card tx-contact__desk tx-dark">
              <Headphones aria-hidden="true" />
              <p><strong>{t('desk.title')}</strong> {t('desk.body')}</p>
            </div>
          </aside>
        </div>
      </section>

      {/* Quick answers (CONTENT §8.3, §8.4) */}
      <section className="tx-contact__faq" aria-labelledby="contact-faq">
        <div className="tx-contact__wrap">
          <h2 className="tx-h2" id="contact-faq">{t('faq.title')}</h2>
          <div className="tx-contact__faq-list">
            {QUICK_ANSWERS.map((a) => (
              <details key={a.id} className="tx-contact__faq-item">
                <summary>{th(`articles.${a.key}.q`)}<Plus aria-hidden="true" /></summary>
                <p>{th(`articles.${a.key}.a`)}</p>
              </details>
            ))}
          </div>
          <Link page="help" onNavigate={onNavigate} className="tx-link">{t('faq.more')}<ArrowRight aria-hidden="true" /></Link>
        </div>
      </section>
    </div>
  );
};
