import { createNamespace, getNamespace, Namespace } from "cls-hooked";

const NS_NAME = "request";
const REQUEST_ID_KEY = "requestId";

export const clsNamespace: Namespace =
  getNamespace(NS_NAME) ?? createNamespace(NS_NAME);

export function setRequestId(id: string): void {
  clsNamespace.set(REQUEST_ID_KEY, id);
}

export function getRequestId(): string | undefined {
  return clsNamespace.get(REQUEST_ID_KEY);
}
