export default function Head() {
  // Add cross-platform PWA capability meta while keeping Apple's meta from generateMetadata()
  return (
    <>
      <meta name="mobile-web-app-capable" content="yes" />
    </>
  );
}
