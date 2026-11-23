export function Brand({ large = false }: { large?: boolean }) {
  return <span className={`brand-wordmark ${large ? 'brand-wordmark-large' : ''}`}>Фин<span>Смарт</span></span>;
}
