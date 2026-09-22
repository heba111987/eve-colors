<?php

namespace App\Filament\Resources\UserResponses\Pages;

use App\Filament\Resources\UserResponses\UserResponseResource;
use Filament\Resources\Pages\ListRecords;

class ListUserResponses extends ListRecords
{
    protected static string $resource = UserResponseResource::class;
}
