import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Hebrew is primary: the bare root sends people to /he.
  //
  // Deliberately NOT permanent. A 308 is cached by the browser essentially
  // forever, and the day we add Accept-Language negotiation (or a remembered
  // preference) every returning visitor would still be pinned to /he by their
  // own cache. Cheap to make permanent later; impossible to take back.
  async redirects() {
    return [{ source: '/', destination: '/he', permanent: false }];
  },
};

export default nextConfig;
