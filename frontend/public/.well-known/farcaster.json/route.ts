import { minikitConfig } from "../../../minikit.config";

function withValidProperties(properties: Record<string, undefined | string | string[]>) {
return Object.fromEntries(
    Object.entries(properties).filter(([_, value]) => (Array.isArray(value) ? value.length > 0 : !!value))
);
}

export async function GET() {
// const URL = process.env.NEXT_PUBLIC_URL as string;
const URL = "https://base-monopoly.vercel.app/" as string;
return Response.json(minikitConfig); // see the next step for the manifest_json_object
}