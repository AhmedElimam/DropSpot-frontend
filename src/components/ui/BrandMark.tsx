import { View, Image } from 'react-native';

const brandLogo = require('@/assets/images/brand-logo.png');

// The pin mark is portrait (≈0.82 wide-to-tall). Sizing by height and deriving the
// width keeps it crisp and centred — never squished into a square.
const ASPECT = 0.82;

interface BrandMarkProps {
  /** Height of the tile (with tile) or of the logo itself (tile=false), in px. */
  size?: number;
  /** Opt-in rounded white tile behind the mark. Default OFF — the transparent
   *  pin renders directly (no background), as the brand asset intends. */
  tile?: boolean;
}

/**
 * The app's pin logo as a small, reusable brand mark. Used in the dark hero
 * headers of the role home screens so the brand is present in-app, not only on
 * the launcher icon / splash / auth screens. Renders the TRANSPARENT logo with
 * no background by default.
 */
export function BrandMark({ size = 44, tile = false }: BrandMarkProps) {
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
