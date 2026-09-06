import { h, type FunctionalComponent } from 'vue'

export interface IconProps {
  size?: number | string
  class?: string
  thickness?: number | string
}

function createSvg(innerPaths: Array<{ tag: string; attrs: Record<string, any> }>, defaultProps?: IconProps): FunctionalComponent<IconProps> {
  return (props: IconProps) => {
    const size = props.size ?? defaultProps?.size ?? 24
    const thickness = props.thickness ?? defaultProps?.thickness ?? 2

    return h(
      'svg',
      {
        class: props.class,
        xmlns: 'http://www.w3.org/2000/svg',
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': thickness,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
      innerPaths.map(p => h(p.tag, p.attrs))
    )
  }
}

export const SearchIcon = createSvg([
  { tag: 'path', attrs: { stroke: 'none', d: 'M0 0h24v24H0z', fill: 'none' } },
  { tag: 'path', attrs: { d: 'M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0' } },
  { tag: 'path', attrs: { d: 'M21 21l-6 -6' } },
])

export const FolderIcon = createSvg([
  { tag: 'path', attrs: { stroke: 'none', d: 'M0 0h24v24H0z', fill: 'none' } },
  { tag: 'path', attrs: { d: 'M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2' } },
])

export const PluginIcon = createSvg([
  { tag: 'path', attrs: { stroke: 'none', d: 'M0 0h24v24H0z', fill: 'none' } },
  { tag: 'path', attrs: { d: 'M9.785 6l8.215 8.215l-2.054 2.054a5.81 5.81 0 1 1 -8.215 -8.215l2.054 -2.054z' } },
  { tag: 'path', attrs: { d: 'M4 20l3.5 -3.5' } },
  { tag: 'path', attrs: { d: 'M15 4l-3.5 3.5' } },
  { tag: 'path', attrs: { d: 'M20 9l-3.5 3.5' } },
])

export const SunIcon = createSvg([
  { tag: 'path', attrs: { stroke: 'none', d: 'M0 0h24v24H0z', fill: 'none' } },
  { tag: 'path', attrs: { d: 'M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0' } },
  { tag: 'path', attrs: { d: 'M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7' } },
])

export const MoonIcon = createSvg([
  { tag: 'path', attrs: { stroke: 'none', d: 'M0 0h24v24H0z', fill: 'none' } },
  { tag: 'path', attrs: { d: 'M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z' } },
])

export const SettingsIcon = createSvg([
  { tag: 'path', attrs: { stroke: 'none', d: 'M0 0h24v24H0z', fill: 'none' } },
  { tag: 'path', attrs: { d: 'M19.875 6.27a2.225 2.225 0 0 1 1.125 1.948v7.284c0 .809 -.443 1.555 -1.158 1.948l-6.75 4.27a2.269 2.269 0 0 1 -2.184 0l-6.75 -4.27a2.225 2.225 0 0 1 -1.158 -1.948v-7.285c0 -.809 .443 -1.554 1.158 -1.947l6.75 -3.98a2.33 2.33 0 0 1 2.25 0l6.75 3.98h-.033z' } },
  { tag: 'path', attrs: { d: 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0' } },
])

export const ReloadIcon = createSvg([
  { tag: 'path', attrs: { stroke: 'none', d: 'M0 0h24v24H0z', fill: 'none' } },
  { tag: 'path', attrs: { d: 'M19.933 13.041a8 8 0 1 1 -9.925 -8.788c3.899 -1 7.935 1.007 9.425 4.747' } },
  { tag: 'path', attrs: { d: 'M20 4v5h-5' } },
])

export const PowerIcon = createSvg([
  { tag: 'path', attrs: { stroke: 'none', d: 'M0 0h24v24H0z', fill: 'none' } },
  { tag: 'path', attrs: { d: 'M7 6a7.75 7.75 0 1 0 10 0' } },
  { tag: 'path', attrs: { d: 'M12 4l0 8' } },
])

export const BoltIcon = createSvg([
  { tag: 'path', attrs: { stroke: 'none', d: 'M0 0h24v24H0z', fill: 'none' } },
  { tag: 'path', attrs: { d: 'M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11' } },
])

export const LoaderIcon = createSvg([
  { tag: 'path', attrs: { stroke: 'none', d: 'M0 0h24v24H0z', fill: 'none' } },
  { tag: 'path', attrs: { d: 'M12 6l0 -3' } },
  { tag: 'path', attrs: { d: 'M16.25 7.75l2.15 -2.15' } },
  { tag: 'path', attrs: { d: 'M18 12l3 0' } },
  { tag: 'path', attrs: { d: 'M16.25 16.25l2.15 2.15' } },
  { tag: 'path', attrs: { d: 'M12 18l0 3' } },
  { tag: 'path', attrs: { d: 'M7.75 16.25l-2.15 2.15' } },
  { tag: 'path', attrs: { d: 'M6 12l-3 0' } },
  { tag: 'path', attrs: { d: 'M7.75 7.75l-2.15 -2.15' } },
])

export const LinkIcon = createSvg([
  { tag: 'path', attrs: { stroke: 'none', d: 'M0 0h24v24H0z', fill: 'none' } },
  { tag: 'path', attrs: { d: 'M9 15l6 -6' } },
  { tag: 'path', attrs: { d: 'M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464' } },
  { tag: 'path', attrs: { d: 'M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463' } },
])

export const GitHubIcon: FunctionalComponent<IconProps> = (props) => {
  const size = props.size ?? 24
  return h(
    'svg',
    {
      class: props.class,
      xmlns: 'http://www.w3.org/2000/svg',
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
    },
    [
      h('path', {
        fill: 'currentColor',
        stroke: 'none',
        d: 'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12'
      })
    ]
  )
}
