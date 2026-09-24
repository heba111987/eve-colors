<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SessionUserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'email' => $this->email,
            'displayName' => $this->name,
            'consentAcceptedAt' => $this->consent_accepted_at?->toISOString(),
            'analyticsConsentAt' => $this->analytics_consent_at?->toISOString(),
            'marketingConsentAt' => $this->marketing_consent_at?->toISOString(),
            'momentCount' => $this->userResponses()->count(),
        ];
    }
}
