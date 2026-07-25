import Link from "next/link";
import { Icon } from "@/components/Icon";
import { paginationRangeLabel, TABLE_PAGE_SIZE, totalPagesFor } from "@/lib/pagination";

function visiblePages(currentPage: number, totalPages: number) {
  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export function TablePagination({
  currentPage,
  end,
  hrefForPage,
  pageSize = TABLE_PAGE_SIZE,
  start,
  totalItems,
}: {
  currentPage: number;
  end: number;
  hrefForPage: (page: number) => string;
  pageSize?: number;
  start: number;
  totalItems: number;
}) {
  const totalPages = totalPagesFor(totalItems, pageSize);
  if (totalItems <= pageSize) return null;

  const previousPage = Math.max(1, currentPage - 1);
  const nextPage = Math.min(totalPages, currentPage + 1);

  return (
    <nav className="table-pagination" aria-label="Paginación de tabla">
      <span>Mostrando {paginationRangeLabel(totalItems, start, end)}</span>
      <div>
        <Link
          aria-disabled={currentPage === 1}
          className={currentPage === 1 ? "is-disabled" : undefined}
          href={hrefForPage(previousPage)}
        >
          <Icon name="chevron_left" />
        </Link>
        {visiblePages(currentPage, totalPages).map((page) => (
          <Link
            aria-current={page === currentPage ? "page" : undefined}
            className={page === currentPage ? "is-active" : undefined}
            href={hrefForPage(page)}
            key={page}
          >
            {page}
          </Link>
        ))}
        <Link
          aria-disabled={currentPage === totalPages}
          className={currentPage === totalPages ? "is-disabled" : undefined}
          href={hrefForPage(nextPage)}
        >
          <Icon name="chevron_right" />
        </Link>
      </div>
    </nav>
  );
}
