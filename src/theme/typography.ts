export const fonts = {
  regular: 'Cairo-Regular',
  medium: 'Cairo-Medium',
  bold: 'Cairo-Bold',
} as const;

export const textStyles = {
  body: { fontFamily: fonts.regular, lineHeight: 26 },
  bodyMedium: { fontFamily: fonts.medium, lineHeight: 26 },
  heading: { fontFamily: fonts.bold, lineHeight: 34 },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 20 },
};
