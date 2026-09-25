import { Link } from 'expo-router';
import Head from 'expo-router/head';
import { Image, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '../lib/theme';

export const LEGAL_ENTITY = 'Eve Colors LLC';
export const CONTACT_EMAIL = 'hello@evecolors.com';

// A string renders as a paragraph, a string[] as a bulleted list.
export type LegalBlock = string | string[];
export type LegalSection = { heading: string; blocks: LegalBlock[] };

type Props = {
  title: string;
  effectiveDate: string;
  intro: string;
  sections: LegalSection[];
};

// Public (unauthenticated) page shell for the Privacy Policy and Terms of
// Service — see the AuthGate bypass in app/_layout.tsx.
export function LegalPage({ title, effectiveDate, intro, sections }: Props) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Head>
        <title>{`${title} · Eve Colors`}</title>
      </Head>

      <Link href="/" style={styles.brand}>
        <View style={styles.brandRow}>
          <Image source={require('../assets/images/icon.png')} style={styles.brandMark} resizeMode="contain" />
          <Text style={styles.brandName}>Eve Colors</Text>
        </View>
      </Link>

      <Text role="heading" aria-level={1} style={styles.title}>{title}</Text>
      <Text style={styles.effective}>Effective {effectiveDate}</Text>
      <Text style={styles.paragraph}>{intro}</Text>

      {sections.map((section, i) => (
        <View key={section.heading} style={styles.section}>
          <Text role="heading" aria-level={2} style={styles.heading}>{`${i + 1}. ${section.heading}`}</Text>
          {section.blocks.map((block, j) =>
            typeof block === 'string' ? (
              <Text key={j} style={styles.paragraph}>{block}</Text>
            ) : (
              <View key={j} style={styles.list}>
                {block.map((item) => (
                  <View key={item} style={styles.listItem}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={[styles.paragraph, { flex: 1 }]}>{item}</Text>
                  </View>
                ))}
              </View>
            ),
          )}
        </View>
      ))}

      <View style={styles.footer}>
        <Text style={styles.paragraph}>
          Questions? Email us at{' '}
          <Text style={styles.link} onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)}>
            {CONTACT_EMAIL}
          </Text>
          .
        </Text>
        <View style={styles.footerLinks}>
          <Link href="/privacy" style={styles.link}>Privacy Policy</Link>
          <Text style={styles.footerDot}>·</Text>
          <Link href="/terms" style={styles.link}>Terms of Service</Link>
        </View>
        <Text style={styles.copyright}>
          © {new Date().getFullYear()} {LEGAL_ENTITY}. All rights reserved.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.space[6], maxWidth: 680, width: '100%', alignSelf: 'center' },
  brand: { alignSelf: 'flex-start', marginBottom: theme.space[8] },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandMark: { width: 30, height: 30 },
  brandName: { fontFamily: theme.font.heading, fontSize: 17, color: theme.colors.text },
  title: { fontFamily: theme.font.heading, fontSize: theme.fontSize.h2, color: theme.colors.text },
  effective: { fontFamily: theme.font.bodySemibold, fontSize: theme.fontSize.small, color: theme.colors.neutral600, marginTop: theme.space[2], marginBottom: theme.space[4] },
  section: { marginTop: theme.space[6] },
  heading: { fontFamily: theme.font.heading, fontSize: theme.fontSize.h4, color: theme.colors.text, marginBottom: theme.space[2] },
  paragraph: { fontFamily: theme.font.body, fontSize: theme.fontSize.body, lineHeight: 24, color: theme.colors.neutral800, marginBottom: theme.space[2] },
  list: { marginBottom: theme.space[2] },
  listItem: { flexDirection: 'row', gap: 10, paddingLeft: 4 },
  bullet: { fontFamily: theme.font.body, fontSize: theme.fontSize.body, lineHeight: 24, color: theme.colors.accent600 },
  link: { fontFamily: theme.font.bodySemibold, color: theme.colors.accent700, textDecorationLine: 'underline' },
  footer: { marginTop: theme.space[8], paddingTop: theme.space[4], borderTopWidth: 1, borderTopColor: theme.colors.neutral200, gap: theme.space[2] },
  footerLinks: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footerDot: { color: theme.colors.neutral500 },
  copyright: { fontFamily: theme.font.body, fontSize: theme.fontSize.tiny, color: theme.colors.neutral600, marginTop: theme.space[2] },
});
