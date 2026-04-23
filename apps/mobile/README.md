# apps/mobile

Expo-powered React Native client foundation for Vyb.

Current shape:

- Android and iOS support through Expo
- consumes shared workspace packages such as `@vyb/app-core`, `@vyb/contracts`, `@vyb/design-tokens`, and `@vyb/ui-native`
- keeps native presentation separate from web presentation
- ready for EAS-based cloud builds from Windows or macOS

Starter commands:

- `pnpm install`
- `pnpm dev:mobile`
- `pnpm --filter @vyb/mobile android`
- `pnpm --filter @vyb/mobile ios`

Env setup:

- copy `apps/mobile/.env.example` to `.env` or set the same `EXPO_PUBLIC_*` vars in your shell
- set `EXPO_PUBLIC_VYB_API_BASE_URL` to your backend host
- use `http://10.0.2.2:4000` for Android emulator against local backend
- use your machine LAN IP for a physical phone

Notes:

- this app targets Expo SDK 54
- the generated Expo stack expects Node `>=20.19.4`; the current local machine is slightly below that, so upgrading Node is recommended before serious device work
