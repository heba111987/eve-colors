<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Filament\Models\Contracts\FilamentUser;
use Filament\Panel;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['name', 'email', 'password', 'google_id', 'avatar_url'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable implements FilamentUser
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'consent_accepted_at' => 'datetime',
            'analytics_consent_at' => 'datetime',
            'marketing_consent_at' => 'datetime',
            'is_admin' => 'boolean',
        ];
    }

    /**
     * @return HasMany<UserResponse>
     */
    public function userResponses(): HasMany
    {
        return $this->hasMany(UserResponse::class);
    }

    public function canAccessPanel(Panel $panel): bool
    {
        // is_admin is intentionally not fillable (Task 2), so a freshly
        // created model instance may never have this attribute set in
        // memory (Eloquent doesn't re-fetch after insert), even though the
        // column defaults to false in the database. Cast defensively so a
        // null in-memory value is treated as "not an admin" rather than
        // throwing a TypeError.
        return (bool) $this->is_admin;
    }
}
