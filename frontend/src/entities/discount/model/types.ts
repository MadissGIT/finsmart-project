export interface Discount {
  id: string;
  category_id: number;
  partner_name: string;
  category_name: string;
  title: string;
  activation: string;
  benefit: string;
  conditions: string;
  discount_percent: number;
  promocode: string | null;
  affiliate_url: string;
  valid_until: string;
  is_demo: boolean;
}

export interface RecommendedDiscountsResponse {
  recommendation_basis: string[];
  items: Discount[];
}
