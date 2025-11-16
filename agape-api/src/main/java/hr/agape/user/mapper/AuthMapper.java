package hr.agape.user.mapper;

import hr.agape.user.domain.UserEntity;
import hr.agape.user.dto.AuthResponseDTO;
import hr.agape.user.dto.RegisterResponseDTO;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "cdi")
public interface AuthMapper {

    @Mapping(target = "userId", source = "user.id")
    @Mapping(target = "username", source = "user.username")
    @Mapping(target = "name", source = "user.name")
    @Mapping(target = "token", source = "token")
    @Mapping(target = "tokenType", constant = "Bearer")
    @Mapping(target = "expiresIn", source = "expiresIn")
    AuthResponseDTO toAuthResponseDto(UserEntity user, String token, long expiresIn);

    @Mapping(target = "userId", source = "id")
    @Mapping(target = "username", source = "username")
    @Mapping(target = "name", source = "name")
    RegisterResponseDTO toRegisterResponseDto(UserEntity user);
}
