"use server";

import { revalidatePath } from "next/cache";
import { demoStore } from "../src/store/demo";

/** Reset demo: throw away everything and re-seed from today. */
export async function resetDemo() {
  demoStore().reset(new Date());
  revalidatePath("/");
}
