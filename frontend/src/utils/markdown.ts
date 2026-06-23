import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Configure marked
marked.setOptions({
  breaks: true,
  gfm: true,
});

export function renderMarkdown(text: string): string {
  if (!text) return '';
  const html = marked.parse(text) as string;
  const sanitizedHtml = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'img', 'ul', 'ol', 'li',
      'blockquote', 'pre', 'code', 'em', 'strong', 'del', 'table', 'thead', 'tbody',
      'tr', 'th', 'td', 'br', 'hr', 'sup', 'sub', 'span', 'div',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
  });
  return sanitizedHtml.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');
}
