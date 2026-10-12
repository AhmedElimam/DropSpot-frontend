import { domainOf, firstLink, hrefOf, linkify } from '../linkify';

describe('links in a message are the ones the server lists', () => {
  it('splits text around links and leaves trailing punctuation as text', () => {
    expect(linkify('شوفوا https://drosspot.app/x?a=1، ده مهم')).toEqual([
      { text: 'شوفوا ' }, { text: 'https://drosspot.app/x?a=1', url: 'https://drosspot.app/x?a=1' }, { text: '، ده مهم' },
    ]);
    expect(linkify('www.example.com.')).toEqual([{ text: 'www.example.com', url: 'https://www.example.com' }, { text: '.' }]);
    expect(linkify('لا روابط هنا 3.5')).toEqual([{ text: 'لا روابط هنا 3.5' }]);
  });
  it('names the site and opens www. links over https', () => {
    expect(domainOf('https://www.youtube.com/watch?v=1')).toBe('youtube.com');
    expect(hrefOf('www.x.com')).toBe('https://www.x.com');
    expect(firstLink('a b http://t.co/z c')).toBe('http://t.co/z');
    expect(firstLink(null)).toBeNull();
  });
});
