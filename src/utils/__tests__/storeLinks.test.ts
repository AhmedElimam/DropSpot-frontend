import { storeLinksFor } from '../storeLinks';

const store = {
  ios_url: 'https://apps.apple.com/eg/app/dros-spot/id6806775859',
  android_url: 'https://play.google.com/store/apps/details?id=com.drosspot.app',
};

describe('storeLinksFor (update screen button)', () => {
  it('opens the App Store app first on iOS, then the web listing', () => {
    expect(storeLinksFor('ios', store, 'com.drosspot.app')).toEqual([
      'itms-apps://apps.apple.com/eg/app/dros-spot/id6806775859',
      'https://apps.apple.com/eg/app/dros-spot/id6806775859',
    ]);
  });

  it('opens Google Play first on Android, then the web listing', () => {
    expect(storeLinksFor('android', store, 'com.drosspot.app')).toEqual([
      'market://details?id=com.drosspot.app',
      'https://play.google.com/store/apps/details?id=com.drosspot.app',
    ]);
  });

  it('follows an overridden Android listing to its own package', () => {
    const links = storeLinksFor('android', { ...store, android_url: 'https://play.google.com/store/apps/details?id=com.other.app&hl=ar' }, 'com.drosspot.app');
    expect(links[0]).toBe('market://details?id=com.other.app');
  });

  it('never sends one platform to the other store', () => {
    expect(storeLinksFor('ios', { ios_url: null, android_url: store.android_url }, 'com.drosspot.app')).toEqual([]);
    expect(storeLinksFor('android', { ios_url: store.ios_url, android_url: null }, 'com.drosspot.app')).toEqual([
      'market://details?id=com.drosspot.app',
      'https://play.google.com/store/apps/details?id=com.drosspot.app',
    ]);
  });
});
