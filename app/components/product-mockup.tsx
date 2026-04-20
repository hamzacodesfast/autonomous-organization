import Image from "next/image";

type ProductMockupProps = {
  alt: string;
  priority?: boolean;
  src: string;
};

export function ProductMockup({ alt, priority = false, src }: ProductMockupProps) {
  return (
    <figure className="mockup-frame">
      <Image className="mockup" src={src} width={2048} height={2048} alt={alt} priority={priority} />
    </figure>
  );
}
