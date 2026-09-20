/** Fixed, decorative aurora backdrop behind the whole page. Pure CSS (see `.aurora*` in globals.css). */
export function Aurora() {
  return (
    <div className="aurora" aria-hidden="true">
      <div className="aurora-sky" />
      <div className="aurora-band aurora-band-fringe" />
      <div className="aurora-band aurora-band-main" />
      <div className="aurora-band aurora-band-curtain" />
      <div className="aurora-stars" />
      <div className="aurora-grain" />
    </div>
  );
}
