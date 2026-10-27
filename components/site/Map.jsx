import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import styles from './Map.module.css';

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const LEAFLET_ATTRIBUTION = '<a href="https://leafletjs.com" title="A JavaScript library for interactive maps">Leaflet</a>';

function numberValue(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function pointFor(latitude, longitude) {
    return [numberValue(latitude, 55.75), numberValue(longitude, 37.62)];
}

function isMobileDevice() {
    if (navigator.userAgentData) return navigator.userAgentData.mobile;
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function webRouteUrl(latitude, longitude) {
    return `https://yandex.ru/maps/?rtext=~${latitude},${longitude}&rtt=auto`;
}

function navigatorRouteUrl(latitude, longitude) {
    return `yandexnavi://build_route_on_map?lat_to=${latitude}&lon_to=${longitude}`;
}

function routeFallback(link) {
    const content = document.createElement('div');
    const fallback = document.createElement('a');

    fallback.href = link;
    fallback.target = '_blank';
    fallback.rel = 'noopener noreferrer';
    fallback.textContent = 'Открыть маршрут в Яндекс Картах';
    content.append(fallback);

    return content;
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
            map.attributionControl.setPrefix(LEAFLET_ATTRIBUTION);
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

            if (markerText) marker.bindTooltip(markerText);

            marker.on('click', () => {
                const { lat, lng } = marker.getLatLng();
                const webRoute = webRouteUrl(lat, lng);

                if (isMobileDevice()) {
                    marker.bindPopup(routeFallback(webRoute)).openPopup();
                    window.location.assign(navigatorRouteUrl(lat, lng));
                    return;
                }

                window.open(webRoute, '_blank', 'noopener,noreferrer');
            });

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
            instance.marker.bindTooltip(markerText);
        } else {
            instance.marker.unbindTooltip();
        }
    }, [latitude, longitude, zoom, markerText]);

    return <div className={`${styles.map} ${className ?? ''}`} ref={containerRef} />;
}
