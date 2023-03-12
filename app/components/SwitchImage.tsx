import type { FunctionComponent } from 'react';
import { useEffect, useState } from 'react';

export const SwitchImage: FunctionComponent<
	{
		images: Array<{
			src: string;
			alt: string;
		}>;
	} & React.DetailedHTMLProps<
		React.ImgHTMLAttributes<HTMLImageElement>,
		HTMLImageElement
	>
> = ({ images, ...props }) => {
	const [selectedImage, setSelectedImage] = useState(0);

	useEffect(() => {
		const interval = setInterval(() => {
			setSelectedImage((selectedImage + 1) % images.length);
		}, 1500);

		return () => clearInterval(interval);
	}, [selectedImage, images]);

	const image = images[selectedImage];

	if (!image) {
		return null;
	}

	const { src, alt } = image;
	return <img {...props} src={src} alt={alt} />;
};
