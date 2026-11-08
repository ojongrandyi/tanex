import React, { useState } from 'react';
import { ArrowRight, Bike, Clock, MapPin } from 'lucide-react';
import { PageHero } from '../components/ui';
import { NetworkMapPanel, useCountryName } from '../components/NetworkMapPanel';
import { Link } from '../router/Link';
import { useAreaT, useLocale } from '../i18n/I18nProvider';
import { GATEWAYS, HUB_CODE, TANEX_LOCATIONS, formatGatewayTime, gatewayName, type GatewayRegion } from '../data/gateways';
import { useNow } from '../utils/useNow';
import './LocationsPage.css';

// Network page (CONTENT §5, §9). "Where our riders deliver" lists the TanEx locations from
// src/data/gateways.ts until the delivery cities come from the database (G.1). The gateways are
// hubs TanEx ships to from Douala, not TanEx facilities (owner to confirm the list, #105).

interface LocationsPageProps {
  onNavigate: (page: string, param?: string) => void;
}

const REGION_ORDER: GatewayRegion[] = ['Africa', 'Europe', 'Middle East', 'Asia', 'Americas'];
// The delivery cities: one card per city (the Douala office and the Douala gateway share one).
const RIDER_CITIES = ['BUE', 'LMB', 'DLO'];

export const LocationsPage: React.FC<LocationsPageProps> = ({ onNavigate }) => {
  const t = useAreaT('network');
  const locale = useLocale();
  const now = useNow();
  const countryName = useCountryName(locale);
  const [activeCode, setActiveCode] = useState(HUB_CODE);

  const modeLabel = { Air: t('gateways.modes.air'), Ocean: t('gateways.modes.ocean'), Road: t('gateways.modes.road') };
  const regions = REGION_ORDER
    .map((region) => ({ region, gateways: GATEWAYS.filter((g) => g.region === region) }))
    .filter((group) => group.gateways.length > 0);
  const riderCities = RIDER_CITIES.map((code) => TANEX_LOCATIONS.find((l) => l.code === code)!).filter(Boolean);

  const showOnMap = (code: string) => {
    setActiveCode(code);
    document.getElementById('network-map')?.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  };

  return (
    <div className="tx-network">
      <PageHero eyebrow={t('hero.eyebrow')} title={t('hero.title')} lead={t('hero.sub')} titleId="network-title" />

      {/* Where our riders deliver */}
      <section className="tx-network__section" aria-labelledby="network-riders">
        <div className="tx-network__wrap">
          <header className="tx-section-header">
            <h2 className="tx-h2" id="network-riders">{t('riders.title')}</h2>
            <p className="tx-lead">{t('riders.intro')}</p>
          </header>
          <ul className="tx-network__cities">
            {riderCities.map((c) => (
              <li key={c.code} className="tx-card">
                <span className="tx-card__icon" aria-hidden="true"><Bike /></span>
                <h3 className="tx-card__title">{c.city}</h3>
                <ul className="tx-network__roles">
                  {(c.roles ?? []).map((r) => <li key={r} className="tx-chip">{t(`riders.roles.${r}`)}</li>)}
                </ul>
                <p className="tx-network__time"><Clock aria-hidden="true" />{formatGatewayTime(c.timeZone, now).time} · {countryName(c.iso, c.country)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Gateways and trade lanes: map + list */}
      <section className="tx-network__section tx-network__section--dark tx-dark" aria-labelledby="network-gateways">
        <div className="tx-network__wrap">
          <header className="tx-section-header">
            <h2 className="tx-h2" id="network-gateways">{t('gateways.title')}</h2>
            <p className="tx-lead">{t('gateways.intro')}</p>
          </header>
          <ul className="tx-network__legend">
            <li><span className="tx-network__lg-base" aria-hidden="true" />{t('legend.base')}</li>
            <li><span className="tx-network__lg-gw" aria-hidden="true" />{t('legend.gateway')}</li>
            <li><span className="tx-network__lg-lane" aria-hidden="true" />{t('legend.lane')}</li>
          </ul>
          <div id="network-map">
            <NetworkMapPanel
              locale={locale}
              onNavigate={onNavigate}
              activeCode={activeCode}
              onSelect={setActiveCode}
              labels={{ mapLabel: t('gateways.mapLabel'), choose: t('gateways.choose'), localTime: t('gateways.localTime'), contact: t('gateways.contact'), modes: modeLabel }}
            />
          </div>
        </div>
      </section>

      <section className="tx-network__section" aria-label={t('gateways.title')}>
        <div className="tx-network__wrap">
          {regions.map(({ region, gateways }) => (
            <section key={region} className="tx-network__region" aria-labelledby={`region-${region.replace(/\s/g, '-')}`}>
              <h3 className="tx-network__region-title" id={`region-${region.replace(/\s/g, '-')}`}>{t(`gateways.regions.${region}`)}</h3>
              <ul className="tx-network__gateways">
                {gateways.map((g) => {
                  const time = formatGatewayTime(g.timeZone, now);
                  return (
                    <li key={g.code} className="tx-network__gw">
                      <div className="tx-network__gw-head">
                        <span className="tx-network__code">{g.code}</span>
                        <div>
                          <h4 className="tx-network__gw-name">{gatewayName(g, locale)}</h4>
                          <p className="tx-network__gw-country"><MapPin aria-hidden="true" />{countryName(g.iso, g.country)}</p>
                        </div>
                      </div>
                      <dl className="tx-network__gw-facts">
                        <div><dt>{t('gateways.modesLabel')}</dt><dd>{g.modes.map((m) => modeLabel[m]).join(' · ')}</dd></div>
                        <div><dt>{t('gateways.localTime')}</dt><dd><span className="tx-network__mono">{time.time}</span> {time.offset}</dd></div>
                      </dl>
                      <div className="tx-network__gw-actions">
                        <button type="button" className="tx-network__show" onClick={() => showOnMap(g.code)}
                          aria-label={t('gateways.showOnMapFor', { name: gatewayName(g, locale) })}>
                          <MapPin aria-hidden="true" /><span>{t('gateways.showOnMap')}</span>
                        </button>
                        <Link page="contact" param={g.code} onNavigate={onNavigate} className="tx-link">{t('gateways.contact')}<ArrowRight aria-hidden="true" /></Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          <div className="tx-network__note">
            <p>{t('note')}</p>
            <Link page="contact" onNavigate={onNavigate} className="tx-btn tx-btn--secondary">{t('noteCta')}</Link>
          </div>
        </div>
      </section>
    </div>
  );
};
