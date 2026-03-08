import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Product = Tables<"products">;
export type Deal = Tables<"deals">;
export type PriceHistory = Tables<"price_history">;

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Product[];
    },
  });
}

export function useDeals() {
  return useQuery({
    queryKey: ["deals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("*, products(*)")
        .order("detected_at", { ascending: false });
      if (error) throw error;
      return data as (Deal & { products: Product })[];
    },
  });
}

export function usePriceHistory(productId: string | null) {
  return useQuery({
    queryKey: ["price_history", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_history")
        .select("*")
        .eq("product_id", productId!)
        .order("recorded_at", { ascending: true });
      if (error) throw error;
      return data as PriceHistory[];
    },
  });
}

export function useAddProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (product: TablesInsert<"products">) => {
      const { data, error } = await supabase.from("products").insert(product).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useAddDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (deal: TablesInsert<"deals">) => {
      const { data, error } = await supabase.from("deals").insert(deal).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deals"] }),
  });
}

export function useUpdateDealStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("deals").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deals"] }),
  });
}

export function usePostToTelegram() {
  return useMutation({
    mutationFn: async (deal: Deal & { products: Product }) => {
      const { data, error } = await supabase.functions.invoke("post-to-telegram", {
        body: {
          productName: deal.products.name,
          oldPrice: deal.old_price,
          newPrice: deal.new_price,
          discountPercent: deal.discount_percent,
          buyLink: deal.products.url,
        },
      });
      if (error) throw error;
      return data;
    },
  });
}
