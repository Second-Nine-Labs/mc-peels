import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Image,
  type LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MascotMark } from '@/components/MascotMark';
import { Button, ErrorBanner, Field } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { usePalette } from '@/lib/theme';

const BANANA = require('../../assets/brand/banana.png');
const NAV_H = 60;

const REASSURANCE = ['You always check out yourself', 'we never see your card', 'filters, not guarantees'];

const STEPS = [
  {
    num: '01',
    kicker: 'Say it',
    title: 'Ask in plain words',
    body: 'Type or tell it what you want, the way you’d say it to a partner. No hunting through listings, no filter menus.',
  },
  {
    num: '02',
    kicker: 'We filter it',
    title: 'Your diet, applied',
    body: 'Organic-preferring, grass-fed, brands you trust, things you avoid — your household’s rules ride along on every item, automatically.',
  },
  {
    num: '03',
    kicker: 'You check out',
    title: 'One tap to Instacart',
    body: 'Get a ready-to-checkout link at your store. You review and pay on Instacart. MC Peels never touches your card.',
  },
];

const HONEST = [
  {
    title: 'Checkout stays on Instacart',
    body: 'MC Peels builds the cart and hands you a link. You pick the store, review the cart, and pay — signed into your own Instacart account.',
  },
  {
    title: 'We never touch your card',
    body: 'No card numbers, no Instacart passwords, nothing to store. MC Peels only ever assembles the list. Your money moves on Instacart, not here.',
  },
  {
    title: 'Filters aren’t guarantees',
    body: '“Organic” and “no peanuts” are strong preferences we apply for you — not a certification. For real sensitivities, your review at checkout is the safety gate.',
  },
];

export default function SignInScreen() {
  const p = usePalette();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  const scrollRef = useRef<ScrollView>(null);
  const howY = useRef(0);
  const signInY = useRef(0);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const scrollTo = (y: number) => scrollRef.current?.scrollTo({ y: Math.max(0, y - NAV_H), animated: true });
  const captureY = (target: 'how' | 'signin') => (e: LayoutChangeEvent) => {
    if (target === 'how') howY.current = e.nativeEvent.layout.y;
    else signInY.current = e.nativeEvent.layout.y;
  };

  const signIn = async () => {
    if (loading) return;
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (authError) setError(authError.message);
    // On success the auth gate in app/_layout.tsx navigates automatically.
    setLoading(false);
  };

  // ---- Nav (sticky) ----
  const nav = (
    <View style={[styles.nav, { backgroundColor: p.background, borderBottomColor: 'rgba(255,255,255,0.18)' }]}>
      <View style={styles.navInner}>
        <View style={styles.brand}>
          <Image source={BANANA} style={styles.navBanana} resizeMode="contain" />
          <View>
            <Text style={styles.brandName}>MC Peels</Text>
            <Text style={[styles.brandSub, { color: p.onBgMuted }]}>By Second 9 Labs</Text>
          </View>
        </View>
        <Pressable onPress={() => scrollTo(signInY.current)} style={[styles.navCta, { backgroundColor: p.card }]}>
          <Text style={[styles.navCtaText, { color: p.text }]}>Sign in</Text>
        </Pressable>
      </View>
    </View>
  );

  // ---- Hero ----
  const cartTicket = (
    <View style={[styles.ticketWrap, wide ? styles.ticketWrapWide : styles.ticketWrapNarrow]}>
      <Image source={BANANA} style={styles.ticketBanana} resizeMode="contain" />
      <View style={[styles.ticket, { backgroundColor: p.card }]}>
        <Text style={[styles.ticketLabel, { color: p.textMuted }]}>You said</Text>
        <Text style={[styles.ticketQuote, { color: p.text }]}>organic bananas, blueberries, grass-fed beef</Text>

        <View style={styles.ticketDivider}>
          <View style={[styles.ticketDividerLine, { backgroundColor: p.tintSoft }]} />
          <Text style={[styles.ticketDividerText, { color: p.tint }]}>MC PEELS FILLED THE CART</Text>
          <View style={[styles.ticketDividerLine, { backgroundColor: p.tintSoft }]} />
        </View>

        {[
          { name: 'Bananas', tags: [['Organic', 'organic']] },
          { name: 'Blueberries', tags: [['Organic', 'organic']] },
          { name: 'Ground beef', tags: [['Grass-fed', 'grass'], ['Organic', 'organic']] },
        ].map((line, i) => (
          <View
            key={line.name}
            style={[styles.ticketRow, { borderBottomColor: p.border }, i === 0 && { borderTopWidth: 1, borderTopColor: p.border }]}
          >
            <View style={styles.ticketRowLeft}>
              <View style={[styles.check, { backgroundColor: p.success }]}>
                <Ionicons name="checkmark" size={13} color="#fff" />
              </View>
              <Text style={[styles.ticketItem, { color: p.text }]}>{line.name}</Text>
            </View>
            <View style={styles.ticketTags}>
              {line.tags.map(([label, kind]) => (
                <View
                  key={label}
                  style={[
                    styles.tag,
                    kind === 'organic'
                      ? { backgroundColor: p.successSoft }
                      : { backgroundColor: p.accentSoft },
                  ]}
                >
                  <Text style={[styles.tagText, { color: kind === 'organic' ? p.success : '#9A6B00' }]}>
                    {label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.ticketFoot}>
          <Text style={[styles.ticketStore, { color: p.textMuted }]}>
            at <Text style={{ color: p.text, fontWeight: '700' }}>your preferred store</Text>
          </Text>
          <View style={[styles.ticketCheckout, { backgroundColor: p.primary }]}>
            <Text style={styles.ticketCheckoutText}>Check out on Instacart</Text>
            <Ionicons name="arrow-forward" size={14} color="#fff" />
          </View>
        </View>
      </View>
    </View>
  );

  const hero = (
    <View style={[styles.hero, { backgroundColor: p.background }]}>
      <View style={[styles.inner, styles.heroInner, wide && styles.heroInnerWide]}>
        <View style={wide ? styles.heroCol : styles.stack}>
          <View style={[styles.eyebrow, { backgroundColor: 'rgba(255,255,255,0.16)' }]}>
            <View style={[styles.eyebrowDot, { backgroundColor: p.accent }]} />
            <Text style={styles.eyebrowText}>Groceries, in plain words</Text>
          </View>
          <Text style={[styles.h1, { color: p.onBg, fontSize: wide ? 58 : 42, lineHeight: wide ? 60 : 46 }]}>
            Just <Text style={{ color: p.accent }}>say</Text> what you want.
          </Text>
          <Text style={[styles.lede, { color: p.onBgMuted }]}>
            Tell MC Peels &ldquo;organic bananas, blueberries, grass-fed beef.&rdquo; You get a
            ready-to-checkout cart at your store &mdash; already filtered to your household&rsquo;s
            diet. Open the link, check out, done.
          </Text>
          <View style={styles.heroCta}>
            <Pressable style={[styles.btn, styles.btnBanana, { backgroundColor: p.accent }]} onPress={() => router.push('/(auth)/sign-up')}>
              <Text style={[styles.btnText, { color: p.onAccent }]}>Create an account</Text>
              <Ionicons name="arrow-forward" size={17} color={p.onAccent} />
            </Pressable>
            <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => scrollTo(howY.current)}>
              <Text style={[styles.btnText, { color: p.onBg }]}>See how it works</Text>
            </Pressable>
          </View>
          <View style={styles.reassure}>
            {REASSURANCE.map((t, i) => (
              <View key={t} style={styles.reassureItem}>
                {i > 0 ? <View style={[styles.reassureDot, { backgroundColor: p.accent }]} /> : null}
                <Text style={[styles.reassureText, { color: p.onBgMuted }]}>{t}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={wide ? styles.heroCartCol : styles.stack}>{cartTicket}</View>
      </View>
    </View>
  );

  // ---- How it works ----
  const howItWorks = (
    <View style={[styles.section, { backgroundColor: p.card }]} onLayout={captureY('how')}>
      <View style={styles.inner}>
        <View style={styles.sectionHead}>
          <View style={[styles.chipSoft, { backgroundColor: p.tintSoft }]}>
            <Text style={[styles.chipSoftText, { color: p.tint }]}>How it works</Text>
          </View>
          <Text style={[styles.h2, { color: p.text }]}>Three steps, and most of them aren&rsquo;t yours.</Text>
          <Text style={[styles.sectionLede, { color: p.textMuted }]}>
            You do the asking and the checking out. MC Peels does the tedious part in the middle
            &mdash; the part where you used to tick &ldquo;organic&rdquo; box by box.
          </Text>
        </View>
        <View style={[styles.grid, wide && styles.gridRow]}>
          {STEPS.map((s) => (
            <View key={s.num} style={[styles.gridItem, wide && styles.gridItemWide]}>
              <Text style={[styles.stepNum, { color: p.tint }]}>{s.num}</Text>
              <Text style={[styles.stepKicker, { color: p.textMuted }]}>{s.kicker}</Text>
              <View style={[styles.stepRule, { backgroundColor: p.accent }]} />
              <Text style={[styles.h3, { color: p.text }]}>{s.title}</Text>
              <Text style={[styles.body, { color: p.textMuted }]}>{s.body}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  // ---- Why it's different ----
  const cards = [
    { icon: 'list-outline', bg: p.tintSoft, ic: p.tint, title: 'One profile, every cart', body: 'Set your household’s diet once — organic, grass-fed, the brands you trust, the stuff you steer clear of. It applies to every order without you lifting a finger.' },
    { icon: 'sparkles-outline', bg: p.accentSoft, ic: '#9A6B00', title: 'An app and an assistant', body: 'Use MC Peels yourself on your phone, or let your AI assistant place the order for you. Same brain behind both doors — your diet applies either way.' },
    { icon: 'shield-checkmark-outline', bg: p.successSoft, ic: p.success, title: 'Honest about the hard parts', body: 'Filters are preferences, not promises. For real allergies, you’re the last set of eyes at checkout — and we tell you so, every time. No over-promising.' },
  ] as const;

  const whyDifferent = (
    <View style={[styles.section, { backgroundColor: '#EDF5FE' }]}>
      <View style={styles.inner}>
        <View style={styles.sectionHead}>
          <View style={[styles.chipSoft, { backgroundColor: p.card }]}>
            <Text style={[styles.chipSoftText, { color: p.tint }]}>Why it&rsquo;s different</Text>
          </View>
          <Text style={[styles.h2, { color: p.text }]}>Set your kitchen&rsquo;s rules once.</Text>
          <Text style={[styles.sectionLede, { color: p.textMuted }]}>
            Grocery apps make you do the translation every single time. MC Peels learns it once and
            carries it forward.
          </Text>
        </View>
        <View style={[styles.grid, wide && styles.gridRow]}>
          {cards.map((c) => (
            <View key={c.title} style={[styles.card, { backgroundColor: p.card }, wide && styles.gridItemWide]}>
              <View style={[styles.cardIcon, { backgroundColor: c.bg }]}>
                <Ionicons name={c.icon} size={24} color={c.ic} />
              </View>
              <Text style={[styles.h3, { color: p.text }]}>
                {c.title.split(/( and )/).map((part, i) =>
                  part === ' and ' ? (
                    <Text key={i} style={{ color: p.accent }}>
                      {' '}and{' '}
                    </Text>
                  ) : (
                    part
                  ),
                )}
              </Text>
              <Text style={[styles.body, { color: p.textMuted }]}>{c.body}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  // ---- Honest band ----
  const honest = (
    <View style={[styles.section, { backgroundColor: p.text }]}>
      <View style={[styles.inner, wide && styles.honestRow]}>
        <View style={wide ? styles.honestLeft : styles.stack}>
          <View style={[styles.chipNavy, { borderColor: 'rgba(255,255,255,0.16)' }]}>
            <Text style={[styles.chipNavyText, { color: p.accent }]}>The fine print, up front</Text>
          </View>
          <Text style={[styles.h2, styles.honestTitle]}>
            You&rsquo;re always the <Text style={{ color: p.accent }}>last</Text> set of eyes.
          </Text>
          <Text style={[styles.sectionLede, { color: p.onBgMuted, marginTop: 12 }]}>
            We&rsquo;re honest about what software can and can&rsquo;t promise &mdash; especially
            where it counts.
          </Text>
        </View>
        <View style={wide ? styles.honestRight : styles.stack}>
          {HONEST.map((h) => (
            <View key={h.title} style={styles.honestPoint}>
              <View style={[styles.honestCheck, { backgroundColor: p.accent }]}>
                <Ionicons name="checkmark" size={15} color={p.text} />
              </View>
              <View style={styles.flex1}>
                <Text style={styles.honestPointTitle}>{h.title}</Text>
                <Text style={styles.honestPointBody}>{h.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  // ---- Sign-in finale ----
  const finale = (
    <View style={[styles.section, styles.finale, { backgroundColor: p.background }]} onLayout={captureY('signin')}>
      <View style={[styles.inner, styles.finaleInner]}>
        <MascotMark size={84} />
        <Text style={[styles.finaleTitle, { color: p.onBg }]}>Stop translating your grocery list.</Text>
        <Text style={[styles.finaleLede, { color: p.onBgMuted }]}>
          Sign in to pick up where your kitchen left off &mdash; or make an account and set your
          household&rsquo;s diet once.
        </Text>

        <View style={[styles.signInCard, { backgroundColor: p.card }]}>
          <Text style={[styles.signInTitle, { color: p.text }]}>Welcome back.</Text>
          <ErrorBanner message={error} />
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            onSubmitEditing={signIn}
          />
          <Button title="Sign in" onPress={signIn} loading={loading} />
          <View style={styles.switchRow}>
            <Text style={{ color: p.textMuted }}>New here? </Text>
            <Link href="/(auth)/sign-up" style={[styles.link, { color: p.tint }]}>
              Create an account
            </Link>
          </View>
        </View>
      </View>
    </View>
  );

  // ---- Footer ----
  const footer = (
    <View style={[styles.footer, { backgroundColor: '#0F1B2E' }]}>
      <View style={[styles.inner, styles.footerInner]}>
        <View style={styles.footerLeft}>
          <Image source={BANANA} style={styles.footerBanana} resizeMode="contain" />
          <Text style={styles.footerText}>&copy; 2026 Second 9 Labs &mdash; a tool from the kitchen</Text>
        </View>
        <View style={styles.footerLinks}>
          <Text style={styles.footerLink}>Privacy</Text>
          <Text style={styles.footerLink}>Terms</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: p.background }]} edges={['top', 'left', 'right']}>
      <ScrollView
        ref={scrollRef}
        stickyHeaderIndices={[0]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {nav}
        {hero}
        {howItWorks}
        {whyDifferent}
        {honest}
        {finale}
        {footer}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  inner: { width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: 24 },
  stack: { width: '100%' },
  flex1: { flex: 1 },

  // Nav
  nav: { borderBottomWidth: 1, height: NAV_H, justifyContent: 'center' },
  navInner: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navBanana: { width: 30, height: 34 },
  brandName: { color: '#fff', fontSize: 19, fontWeight: '800', letterSpacing: -0.3, lineHeight: 21 },
  brandSub: { fontSize: 9, fontWeight: '600', letterSpacing: 1.4, textTransform: 'uppercase', marginTop: 1 },
  navCta: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  navCtaText: { fontWeight: '700', fontSize: 14 },

  // Section shell
  section: { paddingVertical: 64 },
  sectionHead: { maxWidth: 620, marginBottom: 40 },
  sectionLede: { fontSize: 16, lineHeight: 24, marginTop: 12 },
  h2: { fontSize: 34, fontWeight: '800', letterSpacing: -0.6, lineHeight: 38 },
  h3: { fontSize: 20, fontWeight: '700', letterSpacing: -0.2, marginBottom: 8 },
  body: { fontSize: 15, lineHeight: 22 },
  chipSoft: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginBottom: 16 },
  chipSoftText: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },

  // Hero
  hero: { paddingTop: 44, paddingBottom: 60 },
  heroInner: { flexDirection: 'column', gap: 44 },
  heroInnerWide: { flexDirection: 'row', alignItems: 'center', gap: 56 },
  heroCol: { flex: 1.05 },
  heroCartCol: { width: 452 },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 18,
  },
  eyebrowDot: { width: 7, height: 7, borderRadius: 999 },
  eyebrowText: { color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  h1: { fontWeight: '800', letterSpacing: -1, marginBottom: 18 },
  lede: { fontSize: 17, lineHeight: 25, maxWidth: 460 },
  heroCta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 26, marginBottom: 22 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 999,
  },
  btnBanana: {},
  btnGhost: { borderWidth: 2, borderColor: 'rgba(255,255,255,0.55)' },
  btnText: { fontSize: 16, fontWeight: '700' },
  reassure: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  reassureItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reassureDot: { width: 4, height: 4, borderRadius: 999 },
  reassureText: { fontSize: 13, fontWeight: '500' },

  // Cart ticket
  ticketWrap: { position: 'relative' },
  ticketWrapWide: {},
  ticketWrapNarrow: { marginTop: 20 },
  ticketBanana: { position: 'absolute', top: -38, right: -8, width: 92, height: 104, zIndex: 2 },
  ticket: { borderRadius: 24, padding: 24, boxShadow: '0px 30px 60px rgba(6, 25, 46, 0.55)' },
  ticketLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' },
  ticketQuote: { fontSize: 21, fontWeight: '700', lineHeight: 27, marginTop: 4, maxWidth: '82%' },
  ticketDivider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, marginBottom: 6 },
  ticketDividerLine: { flex: 1, height: 2, borderRadius: 2 },
  ticketDividerText: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  ticketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
  },
  ticketRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  check: { width: 22, height: 22, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  ticketItem: { fontSize: 16, fontWeight: '600' },
  ticketTags: { flexDirection: 'row', gap: 6, flexShrink: 0 },
  tag: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  tagText: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  ticketFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 16 },
  ticketStore: { fontSize: 13 },
  ticketCheckout: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999 },
  ticketCheckoutText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Grids (steps + cards)
  grid: { flexDirection: 'column', gap: 28 },
  gridRow: { flexDirection: 'row', gap: 28 },
  gridItem: {},
  gridItemWide: { flex: 1 },
  stepNum: { fontSize: 40, fontWeight: '800', lineHeight: 42 },
  stepKicker: { fontSize: 12, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase', marginTop: 6 },
  stepRule: { height: 4, width: 46, borderRadius: 4, marginTop: 14, marginBottom: 16 },

  card: { borderRadius: 22, padding: 26, boxShadow: '0px 22px 48px rgba(21, 34, 56, 0.14)' },
  cardIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },

  // Honest band
  honestRow: { flexDirection: 'row', alignItems: 'center', gap: 48 },
  honestLeft: { flex: 0.9 },
  honestRight: { flex: 1.1, gap: 14 },
  honestTitle: { color: '#fff', marginTop: 16 },
  honestPoint: {
    flexDirection: 'row',
    gap: 14,
    padding: 18,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  honestCheck: { width: 28, height: 28, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  honestPointTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  honestPointBody: { color: 'rgba(213,234,255,0.72)', fontSize: 14, lineHeight: 21 },
  chipNavy: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  chipNavyText: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },

  // Finale + sign-in
  finale: { paddingVertical: 72 },
  finaleInner: { alignItems: 'center' },
  finaleTitle: { fontSize: 36, fontWeight: '800', letterSpacing: -0.8, textAlign: 'center', marginTop: 18, maxWidth: 460 },
  finaleLede: { fontSize: 16, lineHeight: 24, textAlign: 'center', marginTop: 14, maxWidth: 440 },
  signInCard: {
    width: '100%',
    maxWidth: 440,
    marginTop: 30,
    borderRadius: 24,
    padding: 26,
    boxShadow: '0px 24px 42px rgba(6, 25, 46, 0.35)',
  },
  signInTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4, marginBottom: 18 },
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 18 },
  link: { fontWeight: '700' },

  // Footer
  footer: { paddingVertical: 26 },
  footerInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 },
  footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  footerBanana: { width: 22, height: 26 },
  footerText: { color: 'rgba(213,234,255,0.6)', fontSize: 13 },
  footerLinks: { flexDirection: 'row', gap: 22 },
  footerLink: { color: 'rgba(213,234,255,0.7)', fontSize: 13, fontWeight: '600' },
});
