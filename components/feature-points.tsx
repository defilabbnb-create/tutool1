type FeaturePointsProps = {
  points: string[];
};

export function FeaturePoints({ points }: FeaturePointsProps) {
  return (
    <section className="features" aria-label="Features">
      {points.map((point) => (
        <span key={point} className="feature-pill">
          {point}
        </span>
      ))}
    </section>
  );
}
