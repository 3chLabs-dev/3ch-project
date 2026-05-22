import { useEffect } from "react";
import { Box } from "@mui/material";

type AdFitBannerProps = {
    unitId: string;
    width: number;
    height: number;
    sx?: object;
};

export default function AdFitBanner({ unitId, width, height, sx }: AdFitBannerProps) {
    useEffect(() => {
        const scriptSrc = "https://t1.kakaocdn.net/kas/static/ba.min.js";
        const existingScript = document.querySelector(`script[src="${scriptSrc}"]`);
        if (existingScript) return;

        const script = document.createElement("script");
        script.src = scriptSrc;
        script.async = true;
        document.body.appendChild(script);

        return () => {
            if (script.parentNode) {
                script.parentNode.removeChild(script);
            }
        };
    }, []);

    return (
        <Box sx={{ display: "flex", justifyContent: "center", ...sx }}>
            <ins
                className="kakao_ad_area"
                style={{ display: "none" }}
                data-ad-unit={unitId}
                data-ad-width={String(width)}
                data-ad-height={String(height)}
            />
        </Box>
    );
}
