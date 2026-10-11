'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Pagination } from '@/components/ui/pagination';

export function QueryPagination({ page, totalPages }: { page: number; totalPages: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const changePage = (nextPage: number) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set('page', String(nextPage));
    router.push(`${pathname}?${nextParams.toString()}`, { scroll: false });
  };

  return <Pagination page={page} totalPages={totalPages} onPageChange={changePage} />;
}
