<?php

namespace App\Filament\Resources\UserResponses\Schemas;

use Filament\Schemas\Schema;

class UserResponseForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([]);
    }
}
