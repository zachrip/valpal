import { useEffect, useState } from "react";

export const Gallery = <T extends Array<{ duration: number }>>({
	items,
	render,
}: {
	items: T;
	render: (data: T[number]) => React.ReactNode;
}) => {
	const [selectedElement, setSelectedElement] = useState(0);

	useEffect(() => {
		if (items.length === 0) return;

		const interval = setInterval(() => {
			setSelectedElement((el) => (el + 1) % items.length);
		}, 1500);

		return () => clearInterval(interval);
	}, [items]);

	if (items.length === 0) return null;

	return render(items[selectedElement]);
};
