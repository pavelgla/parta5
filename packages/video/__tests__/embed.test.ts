import { describe, expect, it } from 'vitest';
import { parseEmbedUrl } from '../src/embed/index';

describe('parseEmbedUrl', () => {
  describe('YouTube', () => {
    it('parses standard watch URL', () => {
      const result = parseEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(result).not.toBeNull();
      expect(result!.provider).toBe('youtube');
      expect(result!.embedUrl).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
      expect(result!.videoId).toBe('dQw4w9WgXcQ');
    });

    it('parses short youtu.be URL', () => {
      const result = parseEmbedUrl('https://youtu.be/dQw4w9WgXcQ');
      expect(result).not.toBeNull();
      expect(result!.provider).toBe('youtube');
      expect(result!.embedUrl).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
      expect(result!.videoId).toBe('dQw4w9WgXcQ');
    });

    it('parses URL without www', () => {
      const result = parseEmbedUrl('https://youtube.com/watch?v=abc123XYZ_-');
      expect(result).not.toBeNull();
      expect(result!.provider).toBe('youtube');
      expect(result!.videoId).toBe('abc123XYZ_-');
    });
  });

  describe('RuTube', () => {
    it('parses rutube video URL', () => {
      const result = parseEmbedUrl('https://rutube.ru/video/abc123def456/');
      expect(result).not.toBeNull();
      expect(result!.provider).toBe('rutube');
      expect(result!.embedUrl).toBe('https://rutube.ru/play/embed/abc123def456');
      expect(result!.videoId).toBe('abc123def456');
    });

    it('parses rutube URL without trailing slash', () => {
      const result = parseEmbedUrl('https://rutube.ru/video/abc123def456');
      expect(result).not.toBeNull();
      expect(result!.provider).toBe('rutube');
      expect(result!.embedUrl).toBe('https://rutube.ru/play/embed/abc123def456');
    });
  });

  describe('VK Video', () => {
    it('parses vk.com group video URL', () => {
      const result = parseEmbedUrl('https://vk.com/video-12345_67890');
      expect(result).not.toBeNull();
      expect(result!.provider).toBe('vk');
      expect(result!.embedUrl).toContain('vk.com/video_ext.php');
      expect(result!.embedUrl).toContain('oid=-12345');
      expect(result!.embedUrl).toContain('id=67890');
    });

    it('parses vkvideo.ru URL', () => {
      const result = parseEmbedUrl('https://vkvideo.ru/video-12345_67890');
      expect(result).not.toBeNull();
      expect(result!.provider).toBe('vk');
      expect(result!.embedUrl).toContain('oid=-12345');
      expect(result!.embedUrl).toContain('id=67890');
    });

    it('parses vk.com user video URL (positive oid)', () => {
      const result = parseEmbedUrl('https://vk.com/video98765_11111');
      expect(result).not.toBeNull();
      expect(result!.provider).toBe('vk');
      expect(result!.embedUrl).toContain('oid=98765');
      expect(result!.embedUrl).toContain('id=11111');
    });
  });

  describe('Kinescope', () => {
    it('parses kinescope URL', () => {
      const result = parseEmbedUrl('https://kinescope.io/abcDef123');
      expect(result).not.toBeNull();
      expect(result!.provider).toBe('kinescope');
      expect(result!.embedUrl).toBe('https://kinescope.io/embed/abcDef123');
      expect(result!.videoId).toBe('abcDef123');
    });
  });

  describe('Vimeo', () => {
    it('parses vimeo URL', () => {
      const result = parseEmbedUrl('https://vimeo.com/123456789');
      expect(result).not.toBeNull();
      expect(result!.provider).toBe('vimeo');
      expect(result!.embedUrl).toBe('https://player.vimeo.com/video/123456789');
      expect(result!.videoId).toBe('123456789');
    });

    it('parses vimeo URL with hash', () => {
      const result = parseEmbedUrl('https://vimeo.com/123456789/abcdef');
      expect(result).not.toBeNull();
      expect(result!.provider).toBe('vimeo');
      expect(result!.videoId).toBe('123456789');
    });
  });

  describe('Boomstream', () => {
    it('parses boomstream play URL', () => {
      const result = parseEmbedUrl('https://play.boomstream.com/ABC123code');
      expect(result).not.toBeNull();
      expect(result!.provider).toBe('boomstream');
      expect(result!.embedUrl).toBe('https://play.boomstream.com/ABC123code?embed=1');
      expect(result!.videoId).toBe('ABC123code');
    });
  });

  describe('Дзен', () => {
    it('parses dzen video/watch URL', () => {
      const result = parseEmbedUrl('https://dzen.ru/video/watch/64f12ab34cd56ef78');
      expect(result).not.toBeNull();
      expect(result!.provider).toBe('dzen');
      expect(result!.embedUrl).toBe('https://dzen.ru/embed/64f12ab34cd56ef78');
      expect(result!.videoId).toBe('64f12ab34cd56ef78');
    });
  });

  describe('Google Drive', () => {
    it('parses a share link with usp=drive_link', () => {
      const result = parseEmbedUrl(
        'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrSt-uvWxYz/view?usp=drive_link',
      );
      expect(result).not.toBeNull();
      expect(result!.provider).toBe('google-drive');
      expect(result!.embedUrl).toBe(
        'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrSt-uvWxYz/preview',
      );
      expect(result!.videoId).toBe('1AbCdEfGhIjKlMnOpQrSt-uvWxYz');
    });

    it('parses a share link with usp=sharing', () => {
      const result = parseEmbedUrl('https://drive.google.com/file/d/1abc123/view?usp=sharing');
      expect(result).not.toBeNull();
      expect(result!.provider).toBe('google-drive');
      expect(result!.embedUrl).toBe('https://drive.google.com/file/d/1abc123/preview');
    });

    it('parses a link that is already in preview form', () => {
      const result = parseEmbedUrl('https://drive.google.com/file/d/1abc123/preview');
      expect(result).not.toBeNull();
      expect(result!.provider).toBe('google-drive');
      expect(result!.embedUrl).toBe('https://drive.google.com/file/d/1abc123/preview');
    });
  });

  describe('invalid URLs', () => {
    it('returns null for random URL', () => {
      expect(parseEmbedUrl('https://example.com/video/123')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(parseEmbedUrl('')).toBeNull();
    });

    it('returns null for plain text', () => {
      expect(parseEmbedUrl('not a url at all')).toBeNull();
    });

    it('returns null for unrecognized video service', () => {
      expect(parseEmbedUrl('https://coub.com/view/abc123')).toBeNull();
    });
  });
});
