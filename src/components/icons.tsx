import Svg, {
  Circle,
  G,
  Line,
  Path,
  Rect,
  type SvgProps,
} from 'react-native-svg';

import { colors } from '../theme';

export type NavigationIconName = 'home' | 'exercises' | 'history' | 'settings';

type IconProps = Omit<SvgProps, 'color'> & {
  color?: string;
  size?: number;
};

const lineCap = 'round' as const;
const lineJoin = 'round' as const;

export function NavigationIcon({
  color = colors.textMuted,
  name,
  size = 24,
  ...props
}: IconProps & { name: NavigationIconName }) {
  const strokeProps = {
    fill: 'none' as const,
    stroke: color,
    strokeLinecap: lineCap,
    strokeLinejoin: lineJoin,
    strokeWidth: 2,
  };

  return (
    <Svg
      {...props}
      height={size}
      viewBox="0 0 24 24"
      width={size}
      fill="none"
    >
      {name === 'home' ? (
        <>
          <Path d="m3.5 10.8 8.5-6.9 8.5 6.9" {...strokeProps} />
          <Path d="M5.5 9.5v10.3h13V9.5" {...strokeProps} />
          <Path d="M9.5 19.8v-6h5v6" {...strokeProps} />
        </>
      ) : null}
      {name === 'exercises' ? (
        <>
          <Line x1="4.5" x2="19.5" y1="12" y2="12" {...strokeProps} />
          <Path d="M7.5 8.5v7M4.8 9.7v4.6M16.5 8.5v7M19.2 9.7v4.6" {...strokeProps} />
          <Path d="M8.5 12h7" {...strokeProps} />
        </>
      ) : null}
      {name === 'history' ? (
        <>
          <Rect height="15.5" rx="2" width="15.5" x="4.25" y="4.25" {...strokeProps} />
          <Line x1="8" x2="8" y1="3.5" y2="7" {...strokeProps} />
          <Line x1="16" x2="16" y1="3.5" y2="7" {...strokeProps} />
          <Line x1="4.5" x2="19.5" y1="9" y2="9" {...strokeProps} />
          <Path d="M8 13h2M14 13h2M8 16.5h2M14 16.5h2" {...strokeProps} />
        </>
      ) : null}
      {name === 'settings' ? (
        <>
          <Path
            d="M19.1 13.2a7.4 7.4 0 0 0 0-2.4l1.6-1.2-1.7-2.9-1.9.8a7.6 7.6 0 0 0-2.1-1.2L14.7 4h-3.4l-.3 2.3A7.6 7.6 0 0 0 8.9 7.5L7 6.7 5.3 9.6l1.6 1.2a7.4 7.4 0 0 0 0 2.4l-1.6 1.2L7 17.3l1.9-.8a7.6 7.6 0 0 0 2.1 1.2l.3 2.3h3.4l.3-2.3a7.6 7.6 0 0 0 2.1-1.2l1.9.8 1.7-2.9-1.6-1.2Z"
            {...strokeProps}
          />
          <Circle cx="13" cy="12" r="2.7" {...strokeProps} />
        </>
      ) : null}
    </Svg>
  );
}

export function MuscleGroupIcon({
  color = colors.accent,
  groupId,
  size = 52,
  ...props
}: IconProps & { groupId: string }) {
  const lineProps = {
    fill: 'none' as const,
    stroke: color,
    strokeLinecap: lineCap,
    strokeLinejoin: lineJoin,
    strokeWidth: 2.2,
  };
  const highlightProps = {
    fill: color,
    opacity: 0.2,
    stroke: color,
    strokeLinejoin: lineJoin,
    strokeWidth: 1.3,
  };

  let illustration;

  switch (groupId) {
    case 'pecho':
      illustration = (
        <G>
          <Path d="M22 14c1.8 3.2 4.8 4.8 10 4.8s8.2-1.6 10-4.8" {...lineProps} />
          <Path d="M22 14c-1.8 3.4-4.3 5.2-8.3 6.7L10.9 23c-1 .6-1.6 1.7-1.6 2.9v4.4c0 1 .8 1.8 1.8 1.8.8 0 1.5-.5 1.7-1.3l1.8-5.2v17.7c0 2.8 2.2 5 5 5h24.8c2.8 0 5-2.2 5-5V25.6l1.8 5.2c.2.8.9 1.3 1.7 1.3 1 0 1.8-.8 1.8-1.8v-4.4c0-1.2-.6-2.3-1.6-2.9l-2.8-2.3c-4-1.5-6.5-3.3-8.3-6.7" {...lineProps} />
          <Path d="M20.1 20c3.6.3 7.4 1.8 11.9 5.2V39c-4.2-1.3-7.4-3.5-9.6-6.8-1.8-2.8-2.6-6.8-2.3-12.2Z" {...highlightProps} />
          <Path d="M43.9 20c-3.6.3-7.4 1.8-11.9 5.2V39c4.2-1.3 7.4-3.5 9.6-6.8 1.8-2.8 2.6-6.8 2.3-12.2Z" {...highlightProps} />
          <Path d="M32 24v16" {...lineProps} />
        </G>
      );
      break;
    case 'espalda':
      illustration = (
        <G>
          <Path d="M22 14c1.8 3.2 4.8 4.8 10 4.8s8.2-1.6 10-4.8" {...lineProps} />
          <Path d="M22 14c-1.8 3.4-4.3 5.2-8.3 6.7L10.9 23c-1 .6-1.6 1.7-1.6 2.9v4.4c0 1 .8 1.8 1.8 1.8.8 0 1.5-.5 1.7-1.3l1.8-5.2v17.7c0 2.8 2.2 5 5 5h24.8c2.8 0 5-2.2 5-5V25.6l1.8 5.2c.2.8.9 1.3 1.7 1.3 1 0 1.8-.8 1.8-1.8v-4.4c0-1.2-.6-2.3-1.6-2.9l-2.8-2.3c-4-1.5-6.5-3.3-8.3-6.7" {...lineProps} />
          <Path d="M20.1 20c3.8.7 7.7 2.8 11.9 6.2V42c-5.4-1.2-9.1-3.5-11.2-7.1-1.7-3-2-7.9-.7-14.9Z" {...highlightProps} />
          <Path d="M43.9 20c-3.8.7-7.7 2.8-11.9 6.2V42c5.4-1.2 9.1-3.5 11.2-7.1 1.7-3 2-7.9.7-14.9Z" {...highlightProps} />
          <Path d="M32 20v25" {...lineProps} />
          <Path d="M21 25c3.4 2.2 7.1 3.4 11 3.4s7.6-1.2 11-3.4M21.5 34c3.2 1.7 6.7 2.6 10.5 2.6s7.3-.9 10.5-2.6" {...lineProps} />
        </G>
      );
      break;
    case 'hombro':
      illustration = (
        <G>
          <Path d="M23 14c1.8 3.1 4.8 4.7 9 4.7s7.2-1.6 9-4.7" {...lineProps} />
          <Path d="M23 14c-2.3 3.3-5.2 5.3-9.7 7L10.8 23c-1 .6-1.5 1.7-1.5 2.8v3.8c0 1.1.9 2 2 2 .8 0 1.5-.5 1.8-1.3l1.6-4.7v17.5c0 2.7 2.2 4.9 4.9 4.9h24.8c2.7 0 4.9-2.2 4.9-4.9V25.6l1.6 4.7c.3.8 1 1.3 1.8 1.3 1.1 0 2-.9 2-2v-3.8c0-1.1-.5-2.2-1.5-2.8l-2.5-2c-6.5-1.7-9.4-3.7-11.7-7" {...lineProps} />
          <Circle cx="17" cy="21.7" r="5.3" {...highlightProps} />
          <Circle cx="47" cy="21.7" r="5.3" {...highlightProps} />
          <Path d="M20 25c3.5 1.8 7.5 2.7 12 2.7s8.5-.9 12-2.7" {...lineProps} />
        </G>
      );
      break;
    case 'biceps':
      illustration = (
        <G>
          <Path d="M25 11c-2.2 1.7-3.1 4-2.7 6.9l1.1 7.7c.4 2.7 2.1 5 4.5 6.4l5.4 3.1c2.2 1.3 4.9.5 6.2-1.7 1.2-2.1.5-4.8-1.6-6.2l-4.1-2.7-1.1-7.8c-.5-3.3-2.2-5.3-5.1-6.1Z" {...lineProps} />
          <Path d="M26.2 16.3c2.7-.5 5.1.8 5.7 3.3l1.2 5.3c.3 1.6-.5 3.2-2 4l-3.1 1.6c-2.4-1.4-3.8-3.4-4.2-5.8l-1-6.1c.5-1.1 1.6-1.9 3.4-2.3Z" {...highlightProps} />
          <Path d="M24.8 11c-.5-2.8.2-4.8 2.1-6.1M27 4.9l-2.5-.7M27 4.9l.2-2.5" {...lineProps} />
          <Path d="m38.2 27.2 5.1 3.3c1.6 1 2.1 3.1 1 4.7l-1.7 2.6c-1 1.6-3.1 2.1-4.7 1l-5.1-3.3" {...lineProps} />
          <Path d="M42.2 35.8 47 39" {...lineProps} />
        </G>
      );
      break;
    case 'triceps':
      illustration = (
        <G>
          <Path d="M25 11c-2.2 1.7-3.1 4-2.7 6.9l1.1 7.7c.4 2.7 2.1 5 4.5 6.4l5.4 3.1c2.2 1.3 4.9.5 6.2-1.7 1.2-2.1.5-4.8-1.6-6.2l-4.1-2.7-1.1-7.8c-.5-3.3-2.2-5.3-5.1-6.1Z" {...lineProps} />
          <Path d="M23.6 16.9c2.5.7 4.5 2.5 5.5 5l2.2 5.7c-1.2 1.8-2.9 2.8-5 3-2.4-1.4-3.8-3.4-4.2-5.8l-1-6.1c.4-.9 1.2-1.5 2.5-1.8Z" {...highlightProps} />
          <Path d="M24.8 11c-.5-2.8.2-4.8 2.1-6.1M27 4.9l-2.5-.7M27 4.9l.2-2.5" {...lineProps} />
          <Path d="m38.2 27.2 5.1 3.3c1.6 1 2.1 3.1 1 4.7l-1.7 2.6c-1 1.6-3.1 2.1-4.7 1l-5.1-3.3" {...lineProps} />
          <Path d="M42.2 35.8 47 39" {...lineProps} />
        </G>
      );
      break;
    case 'antebrazos':
      illustration = (
        <G>
          <Path d="M17 12c-1.8 1.3-2.8 3.2-2.7 5.5l.4 8.7-5.2 14.5c-.8 2.2.3 4.6 2.5 5.4 2.2.8 4.6-.3 5.4-2.5l5.3-14.6.2-8.3" {...lineProps} />
          <Path d="M47 12c1.8 1.3 2.8 3.2 2.7 5.5l-.4 8.7 5.2 14.5c.8 2.2-.3 4.6-2.5 5.4-2.2.8-4.6-.3-5.4-2.5l-5.3-14.6-.2-8.3" {...lineProps} />
          <Path d="M14.9 27.2c2.1 1.1 4.4 1.5 6.8 1.2M49.1 27.2c-2.1 1.1-4.4 1.5-6.8 1.2" {...highlightProps} />
          <Path d="M19.2 39.2h-6.4M44.8 39.2h6.4" {...lineProps} />
          <Path d="M18.6 12.7 16 8.5M45.4 12.7 48 8.5" {...lineProps} />
        </G>
      );
      break;
    case 'abdomen':
      illustration = (
        <G>
          <Path d="M24 12c1.6 3.4 4.3 5.1 8 5.1s6.4-1.7 8-5.1" {...lineProps} />
          <Path d="M24 12c-2 3.1-4.2 4.9-7.7 6.3L13 20.5c-1 .6-1.5 1.6-1.5 2.8v3.3c0 1 .8 1.8 1.8 1.8.8 0 1.5-.5 1.7-1.3l1.7-4.2v18.6c0 2.8 2.2 5 5 5h20.6c2.8 0 5-2.2 5-5V22.9l1.7 4.2c.2.8.9 1.3 1.7 1.3 1 0 1.8-.8 1.8-1.8v-3.3c0-1.2-.5-2.2-1.5-2.8l-3.3-2.2c-3.5-1.4-5.7-3.2-7.7-6.3" {...lineProps} />
          <Path d="M22 20h20v20.8c0 1.6-1.3 2.9-2.9 2.9H24.9c-1.6 0-2.9-1.3-2.9-2.9V20Z" {...highlightProps} />
          <Path d="M32 20v23M22 27h20M22 34h20" {...lineProps} />
        </G>
      );
      break;
    case 'gluteos':
      illustration = (
        <G>
          <Path d="M23 13c.7 3.8 3.7 6.1 9 6.1s8.3-2.3 9-6.1" {...lineProps} />
          <Path d="M23 13c-1.3 3.4-1.8 7.5-1.4 12.3l1.2 13.1c.3 3.2 2.9 5.6 6.1 5.6h6.2c3.2 0 5.8-2.4 6.1-5.6l1.2-13.1c.4-4.8-.1-8.9-1.4-12.3" {...lineProps} />
          <Path d="M21.8 24.2c3.1-2.5 6.5-3 10.2-1.4v15c-3.4.9-6.4.2-8.8-2.1-1.1-3.7-1.6-7.5-1.4-11.5Z" {...highlightProps} />
          <Path d="M42.2 24.2c-3.1-2.5-6.5-3-10.2-1.4v15c3.4.9 6.4.2 8.8-2.1 1.1-3.7 1.6-7.5 1.4-11.5Z" {...highlightProps} />
          <Path d="M32 21v17.5M22 40.5h-5.2M42 40.5h5.2" {...lineProps} />
        </G>
      );
      break;
    case 'piernas':
      illustration = (
        <G>
          <Path d="M23 11c2 3.5 5 5.2 9 5.2s7-1.7 9-5.2" {...lineProps} />
          <Path d="M23 11c-1.1 3.7-1.8 7.7-1.9 12l-.4 11.2c-.1 2.5 1.6 4.7 4.1 5.1l3.2.5-1.8 11.3c-.4 2.2 1.1 4.3 3.3 4.7 2.2.4 4.3-1.1 4.7-3.3L36 39l-1-8 1-8c.1-4.3-.6-8.3-1.7-12" {...lineProps} />
          <Path d="M41 11c1.1 3.7 1.8 7.7 1.9 12l.4 11.2c.1 2.5-1.6 4.7-4.1 5.1l-3.2.5 1.8 11.3c.4 2.2-1.1 4.3-3.3 4.7-2.2.4-4.3-1.1-4.7-3.3L28 39l1-8-1-8c-.1-4.3.6-8.3 1.7-12" {...lineProps} />
          <Path d="M22 21c3.3 1.7 6.6 1.7 10 0 3.4 1.7 6.7 1.7 10 0M21.1 34.2c2.6.8 5.1.8 7.4 0M42.9 34.2c-2.6.8-5.1.8-7.4 0" {...highlightProps} />
          <Path d="m26.2 51.1-3.9 2M37.8 51.1l3.9 2" {...lineProps} />
        </G>
      );
      break;
    default:
      illustration = <Circle cx="32" cy="32" r="16" {...lineProps} />;
  }

  return (
    <Svg
      {...props}
      height={size}
      viewBox="0 0 64 64"
      width={size}
      fill="none"
    >
      {illustration}
    </Svg>
  );
}
