import React, { useState, useEffect } from 'react';
import { CheckCircle2, MapPin, Send, FileText, Truck, User, Package, RotateCcw, AlertCircle, ListChecks } from 'lucide-react';
import { api } from '../services/api';
import { useAdminData } from '../context/AdminDataContext';
import { CountrySelect } from '../components/forms/CountrySelect';
import { PhoneInput } from '../components/forms/PhoneInput';
import { MeasureInput, MoneyInput, UnitToggle, useUnitLabels } from '../components/forms/UnitControls';
import { getCountry, shortRegion } from '../data/countries';
import { SERVICE_OPTIONS, findServiceOption } from '../data/serviceOptions';
import { formatWeight } from '../shared/units';
import { type TransportMode } from '../shared/transportMode';
import { useCurrency } from '../utils/useCurrency';
import { useApiErrorText, useAreaT } from '../i18n/I18nProvider';
import './QuotePage.css';

// Quote page (CONTENT §7.1, §7.4). Behaviour as before E.5: the same fields, checks and public
// quote API (the server assigns the QR- reference). Services are TanEx's six (CONTENT §3.1),
// stored by their English name; Cameroon is the default origin country and calling code.

// Address as sent to the API: the short region shown after the city ("CM" / "TX"), plus the
// full region, postcode and country as entered.
function addressPayload(countryCode: string, city: string, region: string, postcode: string) {
  return {
    city: city.trim(),
    state: shortRegion(countryCode, region),
    region: region.trim() || undefined,
    postalCode: postcode.trim() || undefined,
    country: getCountry(countryCode)?.name || '',
    countryCode,
  };
}

// "Buea, Cameroon" / "Houston, TX, United States"
function placeLabel(city: string, region: string, countryCode: string) {
  const country = getCountry(countryCode);
  return [city || '—', countryCode === 'US' ? region.trim().toUpperCase() : '', country?.name].filter(Boolean).join(', ');
}

interface QuotePageProps {
  onNavigate: (page: string, param?: string) => void;
  initialService?: string;
}

const DEFAULT_COUNTRY = 'CM';

export const QuotePage: React.FC<QuotePageProps> = ({ onNavigate, initialService }) => {
  const t = useAreaT('quote');
  const apiErrorText = useApiErrorText();
  const { createQuoteRequest } = useAdminData();

  const regionLabel = (code: string) => (code === 'US' ? t('form.state') : code === 'CA' ? t('form.province') : t('form.region'));
  const postcodeLabel = (code: string) => (code === 'US' ? t('form.zip') : code === 'CA' ? t('form.postal') : t('form.postcode'));
  const modeLabel = (m: TransportMode) => t(`modes.${m}`);

  // Your details
  const [customerName, setCustomerName] = useState('');
  const [company, setCompany] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Route: country first, then the fields that fit it (region and postcode optional)
  const [originCountry, setOriginCountry] = useState(DEFAULT_COUNTRY);
  const [originCity, setOriginCity] = useState('');
  const [originState, setOriginState] = useState('');
  const [originZip, setOriginZip] = useState('');
  const [destCountry, setDestCountry] = useState('');
  const [destCity, setDestCity] = useState('');
  const [destState, setDestState] = useState('');
  const [destZip, setDestZip] = useState('');

  // '' = let us recommend the mode
  const [transportMode, setTransportMode] = useState<TransportMode | ''>('');
  const units = useUnitLabels();
  const money = useCurrency();

  // Service, stored by name; preselected from /services/<id> "Get a Quote" buttons.
  const [cargoDescription, setCargoDescription] = useState('');
  const [service, setService] = useState(findServiceOption(initialService).name);
  useEffect(() => {
    if (initialService) setService(findServiceOption(initialService).name);
  }, [initialService]);
  const serviceLabel = (name: string) => t(`services.${findServiceOption(name).key}`);

  // Stored canonically: pounds, inches and USD (the inputs convert for display).
  const [weight, setWeight] = useState<number | ''>('');
  const [pieces, setPieces] = useState('1');
  const [length, setLength] = useState<number | ''>('');
  const [width, setWidth] = useState<number | ''>('');
  const [height, setHeight] = useState<number | ''>('');
  const [declaredValue, setDeclaredValue] = useState<number | ''>('');
  const [specialInstructions, setSpecialInstructions] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [createdQuoteId, setCreatedQuoteId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setFormError(null);
    if (!customerName.trim() || !customerEmail.trim() || !originCountry || !originCity.trim() || !destCountry || !destCity.trim() || weight === '' || !cargoDescription.trim()) {
      setFormError(t('form.errorRequired'));
      return;
    }
    setIsSubmitting(true);
    try {
      const quotePayload = {
        customerName: customerName.trim(),
        company: company.trim() || undefined,
        customerEmail: customerEmail.trim(),
        customerPhone: customerPhone.trim(),
        origin: addressPayload(originCountry, originCity, originState, originZip),
        destination: addressPayload(destCountry, destCity, destState, destZip),
        transportMode: transportMode || undefined,
        cargoDescription: cargoDescription.trim(),
        shipmentType: 'Parcel' as any,
        service: service as any,
        weightLbs: weight,
        pieces: parseInt(pieces, 10) || 1,
        // Optional; only the sides actually entered are sent (inches)
        dimensions: {
          ...(length !== '' ? { length } : {}),
          ...(width !== '' ? { width } : {}),
          ...(height !== '' ? { height } : {}),
        },
        declaredValue: declaredValue === '' ? 0 : declaredValue,
        specialInstructions: specialInstructions.trim() || undefined,
      };
      // Saved in the database; the server assigns the quote reference.
      const result = await api.submitPublicQuote(quotePayload as any);
      createQuoteRequest(result);
      setCreatedQuoteId(result.id);
      setSubmitted(true);
      window.scrollTo({ top: 200, behavior: 'smooth' });
    } catch (err: any) {
      // Nothing was saved: say so rather than showing a reference that doesn't exist.
      setFormError(t('form.errorSend', { reason: apiErrorText(err, t('form.errorNoReply')) }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubmitted(false);
    setCustomerName(''); setCompany(''); setCustomerEmail(''); setCustomerPhone('');
    setOriginCountry(DEFAULT_COUNTRY); setDestCountry(''); setTransportMode('');
    setOriginCity(''); setOriginState(''); setOriginZip('');
    setDestCity(''); setDestState(''); setDestZip('');
    setCargoDescription(''); setWeight(''); setPieces('1');
    setLength(''); setWidth(''); setHeight(''); setDeclaredValue(''); setSpecialInstructions('');
    setFormError(null);
  };

  const steps = [t('steps.review'), t('steps.email'), t('steps.accept')];
  const pieceCount = parseInt(pieces, 10) || 1;
  const req = <span className="tx-label__required" aria-hidden="true">*</span>;
  const opt = <span className="ngf-field-optional">{t('form.optional')}</span>;

  return (
    <div className="ngf-page-quote tx-quote">
      <section className="tx-quote__hero tx-dark" aria-labelledby="quote-title">
        <div className="tx-quote__wrap">
          <p className="tx-eyebrow">{t('page.eyebrow')}</p>
          <h1 className="tx-h1" id="quote-title">{t('page.title')}</h1>
          <p className="tx-lead">{t('page.sub')}</p>
        </div>
      </section>

      <div className="ngf-container-wide ngf-quote-body">
        {submitted ? (
          <div className="quote-confirmation-card" role="status">
            <div className="confirm-header">
              <div className="check-badge-icon"><CheckCircle2 size={48} className="text-emerald" aria-hidden="true" /></div>
              <h2>{t('done.title')}</h2>
              <p>{t('done.reference', { ref: createdQuoteId })}</p>
            </div>

            <div className="admin-review-info-box">
              <div className="info-box-head">
                <ListChecks size={18} className="text-accent flex-shrink-0" aria-hidden="true" />
                <h3>{t('done.next')}</h3>
              </div>
              <ol className="quote-next-steps">{steps.map((step) => <li key={step}>{step}</li>)}</ol>
            </div>

            <div className="quote-receipt-card">
              <div className="receipt-grid">
                <div className="rec-item"><small>{t('done.refLabel')}</small><strong className="font-mono text-accent">{createdQuoteId}</strong></div>
                <div className="rec-item"><small>{t('done.service')}</small><strong>{serviceLabel(service)}{transportMode ? ` · ${modeLabel(transportMode)}` : ''}</strong></div>
                <div className="rec-item span-full"><small>{t('done.route')}</small><strong>{placeLabel(originCity, originState, originCountry)} → {placeLabel(destCity, destState, destCountry)}</strong></div>
                <div className="rec-item span-full">
                  <small>{t('done.cargo')}</small>
                  <strong>{cargoDescription} · {formatWeight(weight, units.system)} · {t(pieceCount > 1 ? 'done.pieces' : 'done.piece', { n: pieceCount })}</strong>
                </div>
              </div>
            </div>

            <div className="quote-confirm-actions">
              <button type="button" className="tx-btn tx-btn--primary" onClick={() => onNavigate('quote-result', createdQuoteId)}>
                <FileText size={16} aria-hidden="true" /><span>{t('done.view')}</span>
              </button>
              <button type="button" className="tx-btn tx-btn--ghost" onClick={handleReset}>
                <RotateCcw size={16} aria-hidden="true" /><span>{t('done.another')}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="ngf-quote-grid">
            <div className="quote-form-card">
              {formError && (
                <div className="quote-form-error" role="alert">
                  <AlertCircle size={18} className="flex-shrink-0" aria-hidden="true" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="quote-calc-form">
                <div className="form-section-divider"><MapPin size={16} className="text-accent" aria-hidden="true" /><span>{t('form.route')}</span></div>

                {([
                  { key: 'origin', title: t('form.from'), country: originCountry, setCountry: setOriginCountry, city: originCity, setCity: setOriginCity, region: originState, setRegion: setOriginState, postcode: originZip, setPostcode: setOriginZip, placeholder: t('form.cityFromPlaceholder') },
                  { key: 'dest', title: t('form.to'), country: destCountry, setCountry: setDestCountry, city: destCity, setCity: setDestCity, region: destState, setRegion: setDestState, postcode: destZip, setPostcode: setDestZip, placeholder: t('form.cityToPlaceholder') },
                ]).map((side) => (
                  <fieldset key={side.key} className="quote-address-fieldset">
                    <legend>{side.title}</legend>
                    <div className="form-row-2">
                      <div className="form-group">
                        <label htmlFor={`${side.key}-country`}>{t('form.country')} {req}</label>
                        <CountrySelect id={`${side.key}-country`} value={side.country} onChange={side.setCountry} className="ngf-input" required placeholder={t('form.countrySearch')} />
                      </div>
                      <div className="form-group">
                        <label htmlFor={`${side.key}-city`}>{t('form.city')} {req}</label>
                        <input id={`${side.key}-city`} type="text" required value={side.city} onChange={(e) => side.setCity(e.target.value)} placeholder={side.placeholder} className="ngf-input" />
                      </div>
                    </div>
                    <div className="form-row-2">
                      <div className="form-group">
                        <label htmlFor={`${side.key}-region`}>{regionLabel(side.country)} {opt}</label>
                        <input id={`${side.key}-region`} type="text" value={side.region} onChange={(e) => side.setRegion(e.target.value)} className="ngf-input" />
                      </div>
                      <div className="form-group">
                        <label htmlFor={`${side.key}-postcode`}>{postcodeLabel(side.country)} {opt}</label>
                        <input id={`${side.key}-postcode`} type="text" value={side.postcode} onChange={(e) => side.setPostcode(e.target.value)} className="ngf-input font-mono" />
                      </div>
                    </div>
                  </fieldset>
                ))}

                <div className="form-section-divider"><Package size={16} className="text-accent" aria-hidden="true" /><span>{t('form.cargo')}</span></div>
                <div className="ngf-heading-with-units quote-units-row">
                  <span className="quote-units-label">{t('form.units')}</span>
                  <UnitToggle label={t('form.units')} />
                </div>

                <div className="form-row-3">
                  <div className="form-group">
                    <label htmlFor="quote-pieces">{t('form.pieces')} {req}</label>
                    <input id="quote-pieces" type="number" min="1" required value={pieces} onChange={(e) => setPieces(e.target.value)} placeholder="1" className="ngf-input font-mono" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="quote-weight">{t('form.weight', { unit: units.weight })} {req}</label>
                    <MeasureInput id="quote-weight" kind="weight" step="0.1" min="0" required value={weight} onChange={setWeight} placeholder={units.system === 'metric' ? '6.5' : '14.5'} className="ngf-input font-mono" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="quote-value">{t('form.declared', { currency: money.currency })} {opt}</label>
                    <MoneyInput id="quote-value" min="0" value={declaredValue} onChange={setDeclaredValue} className="ngf-input font-mono" />
                  </div>
                </div>

                <div className="form-group">
                  <span className="quote-dims-label" id="quote-dims-label">{t('form.dimensions', { unit: units.length })} {opt}</span>
                  <div className="dimensions-row" role="group" aria-labelledby="quote-dims-label">
                    <MeasureInput kind="length" min="0" aria-label={t('form.length', { unit: units.length })} value={length} onChange={setLength} placeholder={t('form.length', { unit: units.length })} className="ngf-input font-mono" />
                    <MeasureInput kind="length" min="0" aria-label={t('form.width', { unit: units.length })} value={width} onChange={setWidth} placeholder={t('form.width', { unit: units.length })} className="ngf-input font-mono" />
                    <MeasureInput kind="length" min="0" aria-label={t('form.height', { unit: units.length })} value={height} onChange={setHeight} placeholder={t('form.height', { unit: units.length })} className="ngf-input font-mono" />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="quote-contents">{t('form.contents')} {req}</label>
                  <input id="quote-contents" type="text" required value={cargoDescription} onChange={(e) => setCargoDescription(e.target.value)} placeholder={t('form.contentsPlaceholder')} className="ngf-input" />
                </div>

                <div className="form-section-divider"><Truck size={16} className="text-accent" aria-hidden="true" /><span>{t('form.service')}</span></div>
                <div className="form-row-2">
                  <div className="form-group">
                    <label htmlFor="quote-service">{t('form.serviceLabel')} {req}</label>
                    <select id="quote-service" value={service} onChange={(e) => setService(e.target.value)} className="ngf-input">
                      {SERVICE_OPTIONS.map((s) => <option key={s.id} value={s.name}>{t(`services.${s.key}`)}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="quote-mode">{t('form.mode')}</label>
                    <select id="quote-mode" value={transportMode} onChange={(e) => setTransportMode(e.target.value as TransportMode | '')} className="ngf-input">
                      <option value="">{t('form.modeAuto')}</option>
                      <option value="Air">{modeLabel('Air')}</option>
                      <option value="Sea">{modeLabel('Sea')}</option>
                      <option value="Road">{modeLabel('Road')}</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="quote-notes">{t('form.instructions')} {opt}</label>
                  <textarea id="quote-notes" rows={3} value={specialInstructions} onChange={(e) => setSpecialInstructions(e.target.value)} className="ngf-input" />
                </div>

                <div className="form-section-divider"><User size={16} className="text-accent" aria-hidden="true" /><span>{t('form.details')}</span></div>
                <div className="form-row-2">
                  <div className="form-group">
                    <label htmlFor="quote-name">{t('form.name')} {req}</label>
                    <input id="quote-name" type="text" required autoComplete="name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="ngf-input" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="quote-company">{t('form.company')} {opt}</label>
                    <input id="quote-company" type="text" autoComplete="organization" value={company} onChange={(e) => setCompany(e.target.value)} className="ngf-input" />
                  </div>
                </div>
                <div className="form-row-2">
                  <div className="form-group">
                    <label htmlFor="quote-email">{t('form.email')} {req}</label>
                    <input id="quote-email" type="email" required autoComplete="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} className="ngf-input" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="quote-phone">{t('form.phone')} {opt}</label>
                    <PhoneInput id="quote-phone" value={customerPhone} onChange={setCustomerPhone} defaultCountry={originCountry || DEFAULT_COUNTRY}
                      className="ngf-input font-mono" placeholder={t('form.phonePlaceholder')} codeLabel={t('form.callingCode')} />
                  </div>
                </div>

                <button type="submit" disabled={isSubmitting} aria-busy={isSubmitting} className="tx-btn tx-btn--primary tx-btn--lg submit-quote-btn">
                  <Send size={18} aria-hidden="true" />
                  <span>{isSubmitting ? t('form.sending') : t('form.submit')}</span>
                </button>
              </form>
            </div>

            <div className="quote-sidebar-col">
              <div className="quote-policy-card">
                <h2>{t('page.sideTitle')}</h2>
                <p>{t('page.sideBody')}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
