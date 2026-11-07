import React from 'react';
import { Home, PackageSearch } from 'lucide-react';
import { Button } from '../components/ui';
import './NotFoundPage.css';

interface NotFoundPageProps {
  onNavigate: (page: string, param?: string) => void;
}

// Any address the site doesn't have (CONTENT §1.1a). The server answers these with status 404.
export const NotFoundPage: React.FC<NotFoundPageProps> = ({ onNavigate }) => (
  <div className="ngf-page-notfound">
    <section className="ngf-container ngf-notfound-inner">
      <p className="ngf-notfound-eyebrow">Error 404</p>
      <h1>Page not found</h1>
      <p className="ngf-notfound-sub">
        The page you're looking for doesn't exist or may have moved. Check the address, or use one of the links below.
      </p>
      <div className="ngf-notfound-actions">
        <Button variant="primary" icon={<Home size={18} />} onClick={() => onNavigate('home')}>
          Back to Home
        </Button>
        <Button variant="ghost" icon={<PackageSearch size={18} />} onClick={() => onNavigate('track')}>
          Track a Shipment
        </Button>
      </div>
      <p className="ngf-notfound-help">
        Need help?{' '}
        <button type="button" className="ngf-notfound-link" onClick={() => onNavigate('contact')}>
          Contact us
        </button>
      </p>
    </section>
  </div>
);
