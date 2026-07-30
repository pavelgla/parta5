'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/react';
import { getFileUrl } from '@/lib/file-url';
import { FileUpload } from '@/components/file-upload';
import { DEFAULT_BRAND_COLOR } from '@/lib/brand';

interface LogoAsset {
  id: string;
}

interface FooterLink {
  title: string;
  url: string;
}

interface School {
  displayName: string | null;
  legalName: string | null;
  domain: string | null;
  brandColor: string | null;
  logoFileAssetId: string | null;
  tagline: string | null;
  contactAddress: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  siteUrl: string | null;
  footerLinks: FooterLink[] | null;
}

interface Props {
  school: School;
}

const MAX_FOOTER_LINKS = 8;

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

export function SchoolSettingsForm({ school }: Props) {
  const utils = trpc.useUtils();
  const updateMutation = trpc.school.update.useMutation();

  const [displayName, setDisplayName] = useState(school.displayName ?? '');
  const [legalName, setLegalName] = useState(school.legalName ?? '');
  const [domain, setDomain] = useState(school.domain ?? '');
  const [brandColor, setBrandColor] = useState(school.brandColor ?? DEFAULT_BRAND_COLOR);
  const [tagline, setTagline] = useState(school.tagline ?? '');
  const [contactAddress, setContactAddress] = useState(school.contactAddress ?? '');
  const [contactPhone, setContactPhone] = useState(school.contactPhone ?? '');
  const [contactEmail, setContactEmail] = useState(school.contactEmail ?? '');
  const [siteUrl, setSiteUrl] = useState(school.siteUrl ?? '');
  const [footerLinks, setFooterLinks] = useState<FooterLink[]>(school.footerLinks ?? []);
  const [logoAsset, setLogoAsset] = useState<LogoAsset | null>(
    school.logoFileAssetId ? { id: school.logoFileAssetId } : null,
  );

  const [formStatus, setFormStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function updateFooterLink(index: number, patch: Partial<FooterLink>) {
    setFooterLinks((links) => links.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addFooterLink() {
    if (footerLinks.length >= MAX_FOOTER_LINKS) return;
    setFooterLinks((links) => [...links, { title: '', url: '' }]);
  }

  function removeFooterLink(index: number) {
    setFooterLinks((links) => links.filter((_, i) => i !== index));
  }

  async function handleLogoUploaded(asset: { id: string }) {
    setLogoAsset(asset);
  }

  async function handleRemoveLogo() {
    setLogoAsset(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFormStatus('saving');
    setErrorMessage(null);

    try {
      const updated = await updateMutation.mutateAsync({
        displayName,
        legalName,
        domain,
        brandColor,
        logoFileAssetId: logoAsset?.id ?? null,
        tagline,
        contactAddress,
        contactPhone,
        contactEmail,
        siteUrl,
        footerLinks: footerLinks
          .map((l) => ({ title: l.title.trim(), url: l.url.trim() }))
          .filter((l) => l.title && l.url),
      });
      setFormStatus('success');
      setTimeout(() => setFormStatus('idle'), 2500);
      void utils.school.get.invalidate();
      void updated;
    } catch (err) {
      setFormStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Произошла ошибка при сохранении');
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Display name */}
      <div>
        <label className={labelClass}>Название системы</label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={200}
          className={inputClass}
          placeholder="Например, «Парта5»"
        />
      </div>

      {/* Legal name */}
      <div>
        <label className={labelClass}>Полное наименование</label>
        <input
          type="text"
          value={legalName}
          onChange={(e) => setLegalName(e.target.value)}
          maxLength={300}
          className={inputClass}
          placeholder="МБОУ «Школа №1»"
        />
      </div>

      {/* Domain */}
      <div>
        <label className={labelClass}>Домен витрины</label>
        <input
          type="text"
          value={domain}
          onChange={(e) => setDomain(e.target.value.trim().toLowerCase())}
          maxLength={253}
          className={`${inputClass} font-mono`}
          placeholder="school.parta5.ru"
        />
      </div>

      {/* Brand color */}
      <div>
        <label className={labelClass}>Фирменный цвет</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(brandColor) ? brandColor : DEFAULT_BRAND_COLOR}
            onChange={(e) => setBrandColor(e.target.value)}
            className="h-10 w-14 shrink-0 cursor-pointer rounded border border-gray-300"
          />
          <input
            type="text"
            value={brandColor}
            onChange={(e) => setBrandColor(e.target.value)}
            maxLength={7}
            className={`${inputClass} font-mono`}
            placeholder="#1D4ED8"
          />
        </div>
      </div>

      {/* Logo */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Логотип</label>
        {logoAsset && (
          <div className="mb-3 flex items-center gap-3">
            <img
              src={getFileUrl(logoAsset)}
              alt="Логотип школы"
              className="h-16 w-16 rounded-lg border border-gray-200 object-contain bg-white"
            />
            <button
              type="button"
              onClick={handleRemoveLogo}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Удалить логотип
            </button>
          </div>
        )}
        <FileUpload accept="image/*" maxSizeMB={5} onUploaded={handleLogoUploaded} />
      </div>

      {/* Tagline */}
      <div>
        <label className={labelClass}>Подзаголовок</label>
        <input
          type="text"
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          maxLength={300}
          className={inputClass}
          placeholder="Короткий девиз или описание школы"
        />
      </div>

      {/* Contact address */}
      <div>
        <label className={labelClass}>Адрес</label>
        <input
          type="text"
          value={contactAddress}
          onChange={(e) => setContactAddress(e.target.value)}
          maxLength={500}
          className={inputClass}
        />
      </div>

      {/* Contact phone */}
      <div>
        <label className={labelClass}>Телефон</label>
        <input
          type="text"
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
          maxLength={50}
          className={inputClass}
          placeholder="+7 (900) 000-00-00"
        />
      </div>

      {/* Contact email */}
      <div>
        <label className={labelClass}>Электронная почта</label>
        <input
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          className={inputClass}
          placeholder="info@school.ru"
        />
      </div>

      {/* Site URL */}
      <div>
        <label className={labelClass}>Сайт организации</label>
        <input
          type="text"
          value={siteUrl}
          onChange={(e) => setSiteUrl(e.target.value)}
          className={inputClass}
          placeholder="https://school.ru"
        />
      </div>

      {/* Footer links */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Быстрые ссылки</label>
        <div className="space-y-2">
          {footerLinks.map((link, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="text"
                value={link.title}
                onChange={(e) => updateFooterLink(index, { title: e.target.value })}
                maxLength={60}
                className={inputClass}
                placeholder="Название"
              />
              <input
                type="text"
                value={link.url}
                onChange={(e) => updateFooterLink(index, { url: e.target.value })}
                className={`${inputClass} font-mono`}
                placeholder="https://..."
              />
              <button
                type="button"
                onClick={() => removeFooterLink(index)}
                className="shrink-0 text-xs text-red-500 hover:text-red-700"
              >
                Удалить
              </button>
            </div>
          ))}
        </div>
        {footerLinks.length < MAX_FOOTER_LINKS && (
          <button
            type="button"
            onClick={addFooterLink}
            className="mt-2 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            + Добавить ссылку
          </button>
        )}
        {footerLinks.length >= MAX_FOOTER_LINKS && (
          <p className="mt-1 text-xs text-gray-400">Максимум {MAX_FOOTER_LINKS} ссылок</p>
        )}
      </div>

      {/* Save */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={formStatus === 'saving'}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {formStatus === 'saving' ? 'Сохранение...' : 'Сохранить'}
        </button>

        {formStatus === 'success' && (
          <span className="text-sm text-green-600">Настройки сохранены</span>
        )}
        {formStatus === 'error' && errorMessage && (
          <span className="text-sm text-red-500">{errorMessage}</span>
        )}
      </div>
    </form>
  );
}
