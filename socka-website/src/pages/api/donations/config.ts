import type { APIRoute } from 'astro';
import { donationJson } from '../../../lib/donations/http';
import { getPublicDonationConfig } from '../../../lib/donations/config';

export const prerender = false;

export const GET: APIRoute = async () =>
  donationJson({
    ok: true,
    config: getPublicDonationConfig()
  });
