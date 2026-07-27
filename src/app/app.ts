import { Component, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminDashboard } from './admin-dashboard';

type Service = {
  icon: string;
  title: string;
  description: string;
  color: string;
};

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, AdminDashboard],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly registrationEndpoint =
    'https://backendsamaservice.onrender.com/v1/professionals/register';

  protected readonly mobileMenuOpen = signal(false);
  protected readonly demoOpen = signal(false);
  protected readonly submitted = signal(false);
  protected readonly registrationState = signal<'idle' | 'sending' | 'success' | 'error'>(
    'idle',
  );
  protected readonly registrationError = signal('');
  protected readonly identityFile = signal<File | null>(null);
  protected readonly selfieFile = signal<File | null>(null);
  protected readonly currentYear = new Date().getFullYear();
  protected readonly adminMode = signal(
    typeof window !== 'undefined' && window.location.hash === '#admin',
  );

  @HostListener('window:hashchange')
  protected syncView(): void {
    this.adminMode.set(window.location.hash === '#admin');
  }

  protected readonly services: Service[] = [
    {
      icon: 'home',
      title: 'Services à domicile',
      description: 'Ménage, cuisine, jardinage et aide à domicile selon vos besoins.',
      color: '#e7f5ee',
    },
    {
      icon: 'tool',
      title: 'Dépannage & réparation',
      description: 'Plombiers, électriciens et techniciens qualifiés près de chez vous.',
      color: '#fff3df',
    },
    {
      icon: 'sparkles',
      title: 'Beauté & bien-être',
      description: 'Coiffure, soins et accompagnement bien-être en toute confiance.',
      color: '#f5eefe',
    },
    {
      icon: 'briefcase',
      title: 'Services professionnels',
      description: 'Des experts disponibles pour vos projets personnels et professionnels.',
      color: '#eaf2ff',
    },
  ];

  protected readonly steps = [
    {
      number: '01',
      title: 'Choisissez un service',
      description: 'Parcourez les catégories et trouvez exactement ce dont vous avez besoin.',
    },
    {
      number: '02',
      title: 'Trouvez votre professionnel',
      description: 'Comparez les profils, les avis et choisissez en toute confiance.',
    },
    {
      number: '03',
      title: 'Échangez directement',
      description: 'Contactez le prestataire et organisez votre intervention simplement.',
    },
  ];

  protected readonly faqs = [
    {
      question: 'Comment trouver un professionnel sur Sama Services ?',
      answer:
        'Sélectionnez une catégorie, consultez les profils disponibles puis contactez directement le professionnel qui vous convient.',
    },
    {
      question: 'Les prestataires sont-ils vérifiés ?',
      answer:
        'Chaque inscription est examinée avant publication. Les avis clients vous aident aussi à choisir avec davantage de sérénité.',
    },
    {
      question: 'L’utilisation de l’application est-elle gratuite ?',
      answer:
        'La recherche et la mise en relation sont gratuites pour les particuliers. Les conditions professionnelles sont présentées lors de l’inscription.',
    },
    {
      question: 'Comment devenir prestataire ?',
      answer:
        'Téléchargez l’application, créez votre profil professionnel et transmettez les informations nécessaires à sa validation.',
    },
  ];

  protected toggleMenu(): void {
    this.mobileMenuOpen.update((isOpen) => !isOpen);
  }

  protected closeMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  protected openDemo(): void {
    this.demoOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  protected closeDemo(): void {
    this.demoOpen.set(false);
    document.body.style.overflow = '';
  }

  protected submitContact(): void {
    this.submitted.set(true);
  }

  protected selectRegistrationFile(event: Event, purpose: 'identity' | 'selfie'): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.registrationError.set('');

    if (file && (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5_000_000)) {
      input.value = '';
      this.registrationError.set(
        'Choisissez une image JPEG, PNG ou WebP de moins de 5 Mo.',
      );
      return;
    }

    if (purpose === 'identity') {
      this.identityFile.set(file);
    } else {
      this.selfieFile.set(file);
    }
  }

  protected async submitRegistration(formValue: {
    name: string;
    job: string;
    phone: string;
    location: string;
    acceptedTerms: boolean;
  }): Promise<void> {
    const identityDocument = this.identityFile();
    const profileSelfie = this.selfieFile();

    if (!identityDocument || !profileSelfie) {
      this.registrationError.set('La pièce d’identité et le selfie sont obligatoires.');
      return;
    }

    this.registrationState.set('sending');
    this.registrationError.set('');

    const payload = new FormData();
    payload.append('name', formValue.name);
    payload.append('job', formValue.job);
    payload.append('phone', formValue.phone);
    payload.append('location', formValue.location);
    payload.append('acceptedTerms', String(formValue.acceptedTerms));
    payload.append('identityDocument', identityDocument);
    payload.append('profileSelfie', profileSelfie);

    try {
      const response = await fetch(this.registrationEndpoint, {
        method: 'POST',
        body: payload,
      });
      const result = (await response.json().catch(() => null)) as
        | { message?: string; error?: { message?: string } }
        | null;

      if (!response.ok) {
        throw new Error(
          result?.message ??
            result?.error?.message ??
            'L’inscription n’a pas pu être envoyée. Veuillez réessayer.',
        );
      }

      this.registrationState.set('success');
    } catch (error) {
      this.registrationState.set('error');
      this.registrationError.set(
        error instanceof Error
          ? error.message
          : 'Une erreur inattendue est survenue. Veuillez réessayer.',
      );
    }
  }
}
