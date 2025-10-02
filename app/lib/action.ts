'use server';

import postgres from 'postgres';
import { z } from 'zod';
import { revalidatePath } from 'next/cache'; 
import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  amount: z.coerce.number(),
  status: z.enum(['pending', 'paid']),
  date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export async function createInvoice(prevState: any, formData: FormData) {
  try {
    const { customerId, amount, status } = CreateInvoice.parse({
      customerId: formData.get('customerId'),
      amount: formData.get('amount'),
      status: formData.get('status'),
    });

    const amountInCents = Math.round(amount * 100);
    const date = new Date().toISOString().split('T')[0]; // Current date in YYYY-MM-DD format

    await sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
  } catch (error) {
    console.error(error);
    return { message: 'Database Error: Failed to Create Invoice.', success: false };
  }
}

export async function updateInvoice(
  prevState: any, 
  formData: FormData
): Promise<{ message: string; success: boolean }> {
  try {
    const id = formData.get('id') as string;
    const { customerId, amount, status } = UpdateInvoice.parse({
      customerId: formData.get('customerId'),
      amount: formData.get('amount'),
      status: formData.get('status'),
    });

    // Convert amount to cents
    const amountInCents = Math.round(amount * 100);

    await sql`
      UPDATE invoices
      SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
      WHERE id = ${id}
    `;

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
  } catch (error) {
    console.error(error);
    return { 
      message: 'Database Error: Failed to update invoice.', 
      success: false 
    };
  }
}

export async function deleteInvoice(
  prevState: any, 
  id: string
): Promise<{ message: string; success: boolean }> {
  try {
    await sql`DELETE FROM invoices WHERE id = ${id}`;  
    revalidatePath('/dashboard/invoices');
    return { message: 'Invoice deleted successfully!', success: true };
  } catch (error) {
    console.error(error);
    return { message: 'Failed to delete invoice.', success: false };
  }
}

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw error;
  }
}