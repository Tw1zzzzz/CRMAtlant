import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { initYandexMetrika, trackYandexPageView } from "@/lib/yandexMetrika";

const YandexMetrika = () => {
  const location = useLocation();
  const previousUrlRef = useRef<string>();

  useEffect(() => {
    initYandexMetrika();
  }, []);

  useEffect(() => {
    const currentUrl = `${location.pathname}${location.search}${location.hash}`;

    if (!previousUrlRef.current) {
      previousUrlRef.current = currentUrl;
      return;
    }

    if (previousUrlRef.current === currentUrl) {
      return;
    }

    previousUrlRef.current = currentUrl;
    trackYandexPageView(currentUrl, { title: document.title });
  }, [location.hash, location.pathname, location.search]);

  return null;
};

export default YandexMetrika;
