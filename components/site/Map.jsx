import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import styles from './Map.module.css';

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function numberValue(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function pointFor(latitude, longitude) {
    return [numberValue(latitude, 55.75), numberValue(longitude, 37.62)];
}

export default function Map({
    latitude,
    longitude,
    zoom,
    markerText = '',
    className,
}) {
    const containerRef = useRef(null);
    const instanceRef = useRef(null);

    useEffect(() => {
        let cancelled = false;

        async function createMap() {
            const module = await import('leaflet');

            if (cancelled || !containerRef.current) return;

            const leaflet = module.default ?? module;
            const point = pointFor(latitude, longitude);
            const map = leaflet.map(containerRef.current, {
                center: point,
                zoom: numberValue(zoom, 14),
                scrollWheelZoom: false,
            });
            const marker = leaflet.marker(point, {
                icon: leaflet.divIcon({
                    className: styles.marker,
                    iconSize: [24, 24],
                    iconAnchor: [12, 24],
                }),
            }).addTo(map);

            leaflet.tileLayer(TILE_URL, {
                attribution: ATTRIBUTION,
                maxZoom: 19,
            }).addTo(map);

            if (markerText) marker.bindPopup(markerText);

            const observer = new ResizeObserver(() => map.invalidateSize());
            observer.observe(containerRef.current);
            instanceRef.current = { map, marker, observer };
        }

        createMap();

        return () => {
            cancelled = true;
            instanceRef.current?.observer.disconnect();
            instanceRef.current?.map.remove();
            instanceRef.current = null;
        };
    }, []);

    useEffect(() => {
        const instance = instanceRef.current;
        if (!instance) return;

        const point = pointFor(latitude, longitude);
        instance.map.setView(point, numberValue(zoom, 14), { animate: false });
        instance.marker.setLatLng(point);

        if (markerText) {
            instance.marker.bindPopup(markerText);
        } else {
            instance.marker.unbindPopup();
        }
    }, [latitude, longitude, zoom, markerText]);

    return <div className={`${styles.map} ${className ?? ''}`} ref={containerRef} />;
}
