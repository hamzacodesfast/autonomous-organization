import Image from "next/image";

type ProductMockupProps = {
  alt: string;
  mark?: boolean;
  priority?: boolean;
  src: string;
};

export function ProductMockup({ alt, mark = false, priority = false, src }: ProductMockupProps) {
  return (
    <figure className="mockup-frame">
      <Image className="mockup" src={src} width={2048} height={2048} alt={alt} priority={priority} />
      {mark ? (
        <figcaption className="mockup-print" aria-label="Autonomous Organization Local No. 001 back print">
          <span>AUTONOMOUS</span>
          <span>ORGANIZATION</span>
          <span>LOCAL NO. 001</span>
        </figcaption>
      ) : null}
    </figure>
  );
}
