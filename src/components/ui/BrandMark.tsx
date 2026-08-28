import { View, Image } from 'react-native';

const brandLogo = require('@/assets/images/brand-logo.png');

// The pin mark is ≈1.14 wide-to-tall (1304×1144). Sizing by height and deriving the
// width keeps it crisp and centred — never squished into a square.
const ASPECT = 1.14;

interface BrandMarkProps {
  /** Height of the tile (with tile) or of the logo itself (tile=false), in px. */
  size?: number;
  /** Rounded white tile behind the mark. Default ON — the brand emblem is dark
   *  navy and both call sites sit on the dark hero, so it needs a light backing
   *  to stay visible. Pass `tile={false}` on a light surface. */
  tile?: boolean;
}

/**
 * The app's emblem as a small, reusable brand mark. Used in the dark hero
 * headers of the role home screens (and the auth hero) so the brand is present
 * in-app, not only on the launcher icon / splash. The emblem is dark navy, so it
 * renders on a light rounded tile by default (visible on the dark hero).
 */
export function BrandMark({ size = 44, tile = true }: BrandMarkProps) {
  const logoHeight = tile ? Math.round(size * 0.74) : size;
  const logo = (
    <Image
      source={brandLogo}
      style={{ height: logoHeight, width: Math.round(logoHeight * ASPECT) }}
      resizeMode="contain"
    />
  );

  if (!tile) {
    return logo;
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        backgroundColor: 'rgba(255,255,255,0.95)',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {logo}
    </View>
  );
}
