import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { ScreenScaffold } from '../src/components/ScreenScaffold';
import { Glass } from '../src/components/Glass';
import { IconCircle } from '../src/components/Buttons';
import { useTheme } from '../src/theme/useTheme';
import { fontFamilies } from '../src/theme/tokens';
import { LEGAL_TEXT } from '../src/data/legalText';

type LegalBlock =
  | { kind: 'h1'; text: string }
  | { kind: 'h2'; text: string }
  | { kind: 'h3'; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'li'; text: string }
  | { kind: 'italic'; text: string }
  | { kind: 'caps'; text: string }
  | { kind: 'hr' }
  | { kind: 'table'; rows: string[][] };

const TABLE_SEPARATOR_RE = /^\|[\s:|-]+\|$/;

/**
 * Deliberately not a general-purpose markdown parser — just enough
 * structure to render this one document (headings, bullet lists, a
 * provider table, inline **bold**, and the ALL-CAPS legal-boilerplate
 * blocks in sections 14/15) as something readable, instead of dumping raw
 * markdown syntax characters onto the screen.
 */
function parseLegalText(md: string): LegalBlock[] {
  const lines = md.split('\n');
  const blocks: LegalBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) {
      i++;
      continue;
    }
    if (line === '---') {
      blocks.push({ kind: 'hr' });
      i++;
      continue;
    }
    if (line.startsWith('### ')) {
      blocks.push({ kind: 'h3', text: line.slice(4) });
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      blocks.push({ kind: 'h2', text: line.slice(3) });
      i++;
      continue;
    }
    if (line.startsWith('# ')) {
      blocks.push({ kind: 'h1', text: line.slice(2) });
      i++;
      continue;
    }
    if (line.startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const rowLine = lines[i].trim();
        if (!TABLE_SEPARATOR_RE.test(rowLine)) {
          rows.push(
            rowLine
              .split('|')
              .slice(1, -1)
              .map((c) => c.trim())
          );
        }
        i++;
      }
      blocks.push({ kind: 'table', rows });
      continue;
    }
    if (line.startsWith('- ')) {
      blocks.push({ kind: 'li', text: line.slice(2) });
      i++;
      continue;
    }
    if (/^\*[^*].*[^*]\*$/.test(line)) {
      blocks.push({ kind: 'italic', text: line.slice(1, -1) });
      i++;
      continue;
    }
    // A long line with no lowercase letters at all is one of the
    // ALL-CAPS legal-disclaimer paragraphs (sections 14/15) — set apart
    // in a bordered card rather than left blending into normal body text.
    if (line.length > 60 && line === line.toUpperCase() && /[A-Z]/.test(line)) {
      blocks.push({ kind: 'caps', text: line });
      i++;
      continue;
    }
    blocks.push({ kind: 'p', text: line });
    i++;
  }
  return blocks;
}

// Bold alternative listed first so the alternation matches "**x**" as bold
// at a given position rather than partially matching it as italic — JS
// regex alternation tries branches left-to-right at each position.
const INLINE_SPLIT_RE = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;

/** Renders **bold** and *italic* runs within an otherwise plain line of text. */
function InlineText({ text, style, boldColor }: { text: string; style: any; boldColor?: string }) {
  const parts = text.split(INLINE_SPLIT_RE);
  return (
    <Text style={style}>
      {parts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <Text key={idx} style={{ fontFamily: fontFamilies.bold, color: boldColor }}>
              {part.slice(2, -2)}
            </Text>
          );
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return (
            <Text key={idx} style={{ fontStyle: 'italic' }}>
              {part.slice(1, -1)}
            </Text>
          );
        }
        return part;
      })}
    </Text>
  );
}

export default function LegalScreen() {
  const { tokens, a1 } = useTheme();
  const blocks = useMemo(() => parseLegalText(LEGAL_TEXT), []);

  return (
    <ScreenScaffold>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconCircle onPress={() => router.back()}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={tokens.text} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M15 18l-6-6 6-6" />
          </Svg>
        </IconCircle>
        <Text style={{ fontSize: 22, fontFamily: fontFamilies.black, color: tokens.text, flex: 1 }} numberOfLines={1}>
          Terms & Privacy Policy
        </Text>
      </View>

      <Glass radius={22} style={{ marginTop: 20, padding: 18 }}>
        {blocks.map((block, i) => {
          switch (block.kind) {
            case 'h1':
              return (
                <Text key={i} style={{ fontSize: 19, fontFamily: fontFamilies.black, color: a1, marginTop: i === 0 ? 0 : 24, marginBottom: 8 }}>
                  {block.text}
                </Text>
              );
            case 'h2':
              return (
                <Text key={i} style={{ fontSize: 16, fontFamily: fontFamilies.heavy, color: tokens.text, marginTop: 20, marginBottom: 6 }}>
                  {block.text}
                </Text>
              );
            case 'h3':
              return (
                <Text key={i} style={{ fontSize: 14, fontFamily: fontFamilies.bold, color: tokens.text, marginTop: 14, marginBottom: 4 }}>
                  {block.text}
                </Text>
              );
            case 'p':
              return <InlineText key={i} text={block.text} boldColor={tokens.text} style={{ fontSize: 13.5, lineHeight: 20, fontFamily: fontFamilies.regular, color: tokens.text2, marginBottom: 10 }} />;
            case 'li':
              return (
                <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 7, paddingLeft: 4 }}>
                  <Text style={{ fontSize: 13.5, color: a1, fontFamily: fontFamilies.bold, lineHeight: 20 }}>{'•'}</Text>
                  <InlineText text={block.text} boldColor={tokens.text} style={{ flex: 1, fontSize: 13.5, lineHeight: 20, fontFamily: fontFamilies.regular, color: tokens.text2 }} />
                </View>
              );
            case 'italic':
              return (
                <Text key={i} style={{ fontSize: 12.5, lineHeight: 18, fontFamily: fontFamilies.medium, fontStyle: 'italic', color: tokens.text3, marginBottom: 12 }}>
                  {block.text}
                </Text>
              );
            case 'caps':
              return (
                <View key={i} style={{ borderRadius: 14, borderWidth: 1, borderColor: tokens.glassBorder, backgroundColor: tokens.field, padding: 12, marginTop: 6, marginBottom: 14 }}>
                  <Text style={{ fontSize: 11.5, lineHeight: 17, fontFamily: fontFamilies.semibold, color: tokens.text2, letterSpacing: 0.2 }}>{block.text}</Text>
                </View>
              );
            case 'hr':
              return <View key={i} style={{ height: 1, backgroundColor: tokens.glassBorder, marginVertical: 18 }} />;
            case 'table':
              return (
                <View key={i} style={{ gap: 10, marginBottom: 14 }}>
                  {block.rows.slice(1).map((row, ri) => (
                    <View key={ri} style={{ borderRadius: 14, borderWidth: 1, borderColor: tokens.glassBorder, padding: 12 }}>
                      <Text style={{ fontSize: 13, fontFamily: fontFamilies.bold, color: tokens.text, marginBottom: 4 }}>{row[0]}</Text>
                      <Text style={{ fontSize: 12, fontFamily: fontFamilies.semibold, color: a1, marginBottom: 3 }}>{row[1]}</Text>
                      <Text style={{ fontSize: 12, fontFamily: fontFamilies.regular, color: tokens.text2, lineHeight: 17 }}>{row[2]}</Text>
                    </View>
                  ))}
                </View>
              );
            default:
              return null;
          }
        })}
      </Glass>
    </ScreenScaffold>
  );
}
