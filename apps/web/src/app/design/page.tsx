import { notFound } from 'next/navigation';
import DesignCatalog from './catalog';
export default function DesignPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <DesignCatalog />;
}
