import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

type ProfessionalStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
type Professional = {
  id: string;
  name: string;
  job: string;
  phone: string;
  location: string;
  status: ProfessionalStatus;
  photoUrl: string | null;
  hasIdentityDocument: boolean;
  createdAt: string;
};

type Overview = {
  professionals: Record<ProfessionalStatus, number>;
  totalProfessionals: number;
  platforms: {
    web: { status: 'online' | 'offline' };
    mobile: { status: 'online' | 'offline' };
  };
};

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss',
})
export class AdminDashboard implements OnInit {
  private readonly apiUrl = 'https://backendsamaservice.onrender.com/v1';

  protected readonly authenticated = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly sessionToken = signal('');
  protected readonly activeFilter = signal<'all' | ProfessionalStatus>('all');
  protected readonly search = signal('');
  protected readonly professionals = signal<Professional[]>([]);
  protected readonly overview = signal<Overview | null>(null);
  protected readonly updatingId = signal('');
  protected readonly selected = signal<Professional | null>(null);

  constructor(@Inject(PLATFORM_ID) private readonly platformId: object) {}

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const savedToken = sessionStorage.getItem('sama-admin-session');
    if (savedToken) {
      this.sessionToken.set(savedToken);
      void this.loadExistingSession();
    }
  }

  protected async connect(): Promise<void> {
    if (!this.email().trim() || !this.password()) {
      this.error.set('Saisissez votre adresse e-mail et votre mot de passe.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    try {
      const result = await this.request<{ data: { token: string } }>('/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email: this.email().trim(), password: this.password() }),
      }, false);
      this.sessionToken.set(result.data.token);
      await this.loadData();
      this.authenticated.set(true);
      if (isPlatformBrowser(this.platformId)) {
        sessionStorage.setItem('sama-admin-session', result.data.token);
      }
      this.password.set('');
    } catch (error) {
      this.authenticated.set(false);
      this.error.set(error instanceof Error ? error.message : 'Connexion impossible.');
    } finally {
      this.loading.set(false);
    }
  }

  protected disconnect(): void {
    sessionStorage.removeItem('sama-admin-session');
    this.authenticated.set(false);
    this.sessionToken.set('');
    this.professionals.set([]);
    this.overview.set(null);
  }

  protected async setFilter(filter: 'all' | ProfessionalStatus): Promise<void> {
    this.activeFilter.set(filter);
    await this.loadProfessionals();
  }

  protected async applySearch(): Promise<void> {
    await this.loadProfessionals();
  }

  protected async updateStatus(professional: Professional, status: ProfessionalStatus): Promise<void> {
    this.updatingId.set(professional.id);
    this.error.set('');
    try {
      await this.request(`/admin/professionals/${professional.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      this.selected.set(null);
      await this.loadData();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Mise à jour impossible.');
    } finally {
      this.updatingId.set('');
    }
  }

  protected statusLabel(status: ProfessionalStatus): string {
    return { pending: 'En attente', approved: 'Validé', rejected: 'Refusé', suspended: 'Suspendu' }[status];
  }

  protected initials(name: string): string {
    return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  }

  protected openDetails(professional: Professional): void {
    this.selected.set(professional);
  }

  protected closeDetails(): void {
    this.selected.set(null);
  }

  private async loadData(): Promise<void> {
    const overview = await this.request<{ data: Overview }>('/admin/overview');
    this.overview.set(overview.data);
    await this.loadProfessionals();
  }

  private async loadProfessionals(): Promise<void> {
    const params = new URLSearchParams({ limit: '100' });
    if (this.activeFilter() !== 'all') params.set('status', this.activeFilter());
    if (this.search().trim()) params.set('q', this.search().trim());
    const result = await this.request<{ data: Professional[] }>(`/admin/professionals?${params}`);
    this.professionals.set(result.data);
  }

  private async loadExistingSession(): Promise<void> {
    try {
      await this.loadData();
      this.authenticated.set(true);
    } catch {
      this.disconnect();
    }
  }

  private async request<T>(path: string, init: RequestInit = {}, authenticated = true): Promise<T> {
    const response = await fetch(`${this.apiUrl}${path}`, {
      ...init,
      headers: {
        ...(authenticated ? { Authorization: `Bearer ${this.sessionToken()}` } : {}),
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
    const result = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    if (!response.ok) throw new Error(result?.error?.message ?? 'Le serveur ne répond pas.');
    return result as T;
  }
}
