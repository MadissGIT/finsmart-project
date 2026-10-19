export interface Discount {
  id: string;
  partner_name: string;
  category_name: string;
  title: string;
  discount_percent: number;
  promocode: string;
  affiliate_url: string;
  valid_until: string;
}

export interface RecommendedDiscountsResponse {
  recommendation_basis: string[];
  items: Discount[];
}
